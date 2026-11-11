import { beforeAll,afterAll,beforeEach,describe,it,expect,vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { initDatabase } from "./db";
import { createRun,createPlan,getPlan,editPlan,stats,updateBrief } from "./repository";
import { defaultBrief, type Plan } from "./model";
import { beginCheckout,completeCheckout } from "./payments";
import { verifyOrder,approvalLink,type PayPalOrder,type PaymentProvider } from "./paypal";
import { issueImpression,recordEvent } from "./serving";

const creative={headline:"Make room for royalty",description:"Keep your finished portrait in a wooden frame.",cta:"Explore PetFrame",benefitIndex:0};
let db:PGlite,plan:Plan,order:PayPalOrder,provider:PaymentProvider;
beforeAll(async()=>{db=await initDatabase(new PGlite());});
afterAll(async()=>{await db.close();});
beforeEach(async()=>{
  const run=await createRun(db,crypto.randomUUID());
  // Each test owns a fresh run; no historical demo records are reset.
  await db.query("UPDATE demo_runs SET owner=$1 WHERE id=$2",[run.id,run.id]);
  plan=await createPlan(db,run,"royal-pets",creative);
  order={id:`ORDER-${plan.id}`,status:"CREATED",purchase_units:[{custom_id:plan.id,amount:{currency_code:"USD",value:"10.00"}}],links:[{rel:"payer-action",href:"https://www.sandbox.paypal.com/checkoutnow?token=TEST"}]};
  provider={create:vi.fn(async()=>structuredClone(order)),get:vi.fn(async()=>structuredClone(order)),capture:vi.fn(async()=>{order.status="COMPLETED";order.purchase_units[0].payments={captures:[{id:`CAP-${plan.id}`,status:"COMPLETED",amount:{currency_code:"USD",value:"10.00"},final_capture:true}]};})};
});
describe("approved payment and serving",()=>{
  it("creates one order for concurrent retries, locks the snapshot and activates only once",async()=>{
    const results=await Promise.all([beginCheckout(db,plan.id,plan.runId,0,provider),beginCheckout(db,plan.id,plan.runId,0,provider)]);
    expect(results[0].orderId).toBe(results[1].orderId);expect(provider.create).toHaveBeenCalledTimes(1);
    await expect(editPlan(db,plan.id,plan.runId,{...creative,headline:"Changed"},0)).rejects.toMatchObject({code:"locked"});
    await updateBrief(db,plan.runId,plan.runId,{...defaultBrief,brand:"New brand"});
    order.status="APPROVED";
    const [a,b]=await Promise.all([completeCheckout(db,plan.id,plan.runId,provider),completeCheckout(db,plan.id,plan.runId,provider)]);
    expect(a).toEqual(b);expect(provider.capture).toHaveBeenCalledTimes(1);expect(a.brief.brand).toBe("PetFrame");expect(a.creative).toEqual(creative);
    const slot=await issueImpression(db,plan.id,"royal-pets",plan.runId,a.startedAt!);
    expect(slot).not.toBeNull();
    expect(await recordEvent(db,plan.id,slot!.impressionId,plan.runId,"view",a.startedAt!+500)).toEqual({recorded:false});
    for(let i=0;i<2;i++){await recordEvent(db,plan.id,slot!.impressionId,plan.runId,"view",a.startedAt!+1001);await recordEvent(db,plan.id,slot!.impressionId,plan.runId,"click",a.startedAt!+1002);}
    expect(await stats(db,plan.id)).toEqual({views:1,clicks:1});
    expect(await issueImpression(db,plan.id,"royal-pets",plan.runId,a.endsAt!)).toBeNull();
    await expect(recordEvent(db,plan.id,slot!.impressionId,plan.runId,"click",a.endsAt!)).rejects.toMatchObject({code:"ended"});
  });
  it("keeps unpaid and cancelled checkouts off the publisher page",async()=>{
    expect(await issueImpression(db,plan.id,"royal-pets",plan.runId)).toBeNull();
    await beginCheckout(db,plan.id,plan.runId,0,provider);
    await expect(completeCheckout(db,plan.id,plan.runId,provider)).rejects.toMatchObject({code:"payment_pending"});
    expect(provider.capture).not.toHaveBeenCalled();expect(await issueImpression(db,plan.id,"royal-pets",plan.runId)).toBeNull();
  });
  it("reconciles an already captured order after a lost capture response",async()=>{
    await beginCheckout(db,plan.id,plan.runId,0,provider);order.status="APPROVED";
    const capture=provider.capture;
    provider.capture=vi.fn(async p=>{await capture(p);throw new Error("connection lost after capture");});
    await expect(completeCheckout(db,plan.id,plan.runId,provider)).rejects.toThrow("connection lost");
    const recovered=await completeCheckout(db,plan.id,plan.runId,provider);
    expect(recovered.status).toBe("active");expect(provider.capture).toHaveBeenCalledTimes(1);
  });
  it("rejects another session, changed approval and wrong publisher",async()=>{
    await expect(beginCheckout(db,plan.id,"stranger",0,provider)).rejects.toMatchObject({status:404});
    await editPlan(db,plan.id,plan.runId,{...creative,headline:"User edit"},0);
    await expect(beginCheckout(db,plan.id,plan.runId,0,provider)).rejects.toMatchObject({code:"changed"});
    expect((await getPlan(db,plan.id,plan.runId)).status).toBe("draft");
    await expect(issueImpression(db,plan.id,"pet-names",plan.runId)).rejects.toMatchObject({code:"wrong_site"});
  });
  it.each(["currency","amount","owner","order","extra-unit"])("rejects mismatched %s before capture",async fault=>{
    await beginCheckout(db,plan.id,plan.runId,0,provider);order.status="APPROVED";
    if(fault==="currency")order.purchase_units[0].amount.currency_code="EUR";
    if(fault==="amount")order.purchase_units[0].amount.value="0.01";
    if(fault==="owner")order.purchase_units[0].custom_id="another-plan";
    if(fault==="order")order.id="another-order";
    if(fault==="extra-unit")order.purchase_units.push(order.purchase_units[0]);
    await expect(completeCheckout(db,plan.id,plan.runId,provider)).rejects.toMatchObject({code:"payment_mismatch"});
    expect(provider.capture).not.toHaveBeenCalled();expect((await getPlan(db,plan.id,plan.runId)).status).toBe("checkout");
  });
  it("rejects pending or wrong capture details and unsafe checkout redirects",()=>{
    order.status="COMPLETED";order.purchase_units[0].payments={captures:[{id:"CAP",status:"PENDING",amount:{currency_code:"USD",value:"10.00"},final_capture:true}]};
    expect(()=>verifyOrder(order,plan,true)).toThrow();
    order.purchase_units[0].payments.captures![0].status="COMPLETED";order.purchase_units[0].payments.captures![0].amount.value="9.00";
    expect(()=>verifyOrder(order,plan,true)).toThrow();
    order.links![0].href="https://www.sandbox.paypal.com.attacker.example/";
    expect(()=>approvalLink(order)).toThrow();
  });
});
