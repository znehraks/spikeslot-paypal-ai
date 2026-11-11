import { z } from "zod";
import { AppError, type Plan } from "./model";

const amount=z.object({currency_code:z.string(),value:z.string()});
const orderSchema=z.object({id:z.string(),status:z.string(),purchase_units:z.array(z.object({custom_id:z.string().optional(),amount,payments:z.object({captures:z.array(z.object({id:z.string(),status:z.string(),amount,final_capture:z.boolean().optional()})).optional()}).optional()})),links:z.array(z.object({rel:z.string(),href:z.string()})).optional()});
export type PayPalOrder=z.infer<typeof orderSchema>;
export interface PaymentProvider {create(plan:Plan):Promise<PayPalOrder>;get(id:string):Promise<PayPalOrder>;capture(plan:Plan):Promise<void>}
const base="https://api-m.sandbox.paypal.com";
export function appOrigin(){
  const url=new URL(process.env.APP_URL||"http://localhost:3610");
  if(url.protocol!=="https:" && !(url.protocol==="http:"&&["localhost","127.0.0.1"].includes(url.hostname)))throw new AppError("app_setup","APP_URL must use HTTPS outside localhost.",503);
  return url.origin;
}
export function verifyOrder(order:PayPalOrder,plan:Plan,completed=false){
  const unit=order.purchase_units[0],value=(plan.priceCents/100).toFixed(2);
  if((plan.orderId&&order.id!==plan.orderId)||order.purchase_units.length!==1||unit?.custom_id!==plan.id||unit.amount.currency_code!=="USD"||unit.amount.value!==value)
    throw new AppError("payment_mismatch","PayPal order details do not match this approved sponsorship. It has not been activated.",409);
  if(!completed)return null;
  const captures=unit.payments?.captures??[],capture=captures[0];
  if(order.status!=="COMPLETED"||captures.length!==1||capture.status!=="COMPLETED"||capture.amount.currency_code!=="USD"||capture.amount.value!==value||capture.final_capture!==true)
    throw new AppError("payment_pending","PayPal has not confirmed a completed payment for this sponsorship. Retry verification after checking PayPal.",409);
  return capture.id;
}
async function api(path:string,method="GET",body?:unknown,requestId?:string):Promise<unknown>{
  const id=process.env.PAYPAL_CLIENT_ID,secret=process.env.PAYPAL_CLIENT_SECRET;
  if(!id||!secret)throw new AppError("paypal_setup","Connect PayPal Sandbox credentials to pay. No test payment is simulated.",503);
  try {
    const auth=await fetch(`${base}/v1/oauth2/token`,{method:"POST",headers:{Authorization:`Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials",signal:AbortSignal.timeout(15000)});
    if(!auth.ok)throw new AppError("paypal_auth","PayPal Sandbox authentication failed. Check server credentials.",502);
    const token=await auth.json();
    const response=await fetch(`${base}${path}`,{method,headers:{Authorization:`Bearer ${token.access_token}`,"Content-Type":"application/json",Prefer:"return=representation",...(requestId?{"PayPal-Request-Id":requestId}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new AppError("paypal_error",`PayPal returned HTTP ${response.status}. Your sponsorship is saved; retry to check the same order.`,502);
    return await response.json();
  } catch(e) {if(e instanceof AppError)throw e;throw new AppError("paypal_connection","PayPal could not be reached. Retry to verify the same order; do not create another purchase.",502);}
}
function parseOrder(data:unknown){
  const parsed=orderSchema.safeParse(data);
  if(!parsed.success)throw new AppError("paypal_response","PayPal returned an unexpected response. Your sponsorship has not been activated.",502);
  return parsed.data;
}
export const paypal:PaymentProvider={
  create:plan=>api("/v2/checkout/orders","POST",{intent:"CAPTURE",purchase_units:[{custom_id:plan.id,invoice_id:plan.id,description:"SpikeSlot: one 30-minute sponsorship (Sandbox)",amount:{currency_code:"USD",value:(plan.priceCents/100).toFixed(2)}}],payment_source:{paypal:{experience_context:{brand_name:"SpikeSlot",shipping_preference:"NO_SHIPPING",user_action:"PAY_NOW",return_url:`${appOrigin()}/studio/${plan.id}?payment=returned`,cancel_url:`${appOrigin()}/studio/${plan.id}?payment=cancelled`}}}},plan.createRequestId).then(parseOrder),
  get:id=>api(`/v2/checkout/orders/${encodeURIComponent(id)}`).then(parseOrder),
  capture:plan=>api(`/v2/checkout/orders/${encodeURIComponent(plan.orderId!)}/capture`,"POST",{},plan.captureRequestId).then(()=>{}),
};
export function approvalLink(order:PayPalOrder){
  const href=order.links?.find(l=>l.rel==="payer-action"||l.rel==="approve")?.href;
  if(!href)throw new AppError("paypal_link","PayPal did not return an approval link. Retry verification of this order.",502);
  const u=new URL(href);
  if(u.protocol!=="https:"||u.hostname!=="www.sandbox.paypal.com"||u.username||u.password)throw new AppError("paypal_link","PayPal returned an unexpected approval destination.",502);
  return href;
}
