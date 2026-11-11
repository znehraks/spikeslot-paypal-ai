import { detectStage, MINUTE_MS, type MinutePoint } from "./detector";
import type { SiteId, Traffic } from "../model";
/** Labeled synthetic minute history; metrics always come from the reused real detector. */
export function replayTraffic(now = new Date()):Record<SiteId,Traffic> {
  const base = Math.floor(now.getTime()/MINUTE_MS)*MINUTE_MS;
  const result = {} as Record<SiteId,Traffic>;
  for(const [id,peak] of [["royal-pets",120],["pet-collage",78],["pet-names",100]] as const){
    const points:MinutePoint[] = Array.from({length:90},(_,i)=>{
      const pv=i<70?4:peak;
      return {minute:new Date(base-(90-i)*MINUTE_MS),pageviews:pv,visitors:Math.floor(pv*.8),botSuspect:0,sources:{"social.example":Math.ceil(pv*.6),"community.example":Math.floor(pv*.4)}};
    });
    const out=detectStage({stage:"normal",baselineRate:4,peakRate:0,stageChangedAt:null,now:new Date(base),points,firstStatsMinute:points[0].minute});
    result[id]={stage:out.stage,rate:out.metrics.rate,baseline:out.metrics.baseline,multiplier:Math.round(out.metrics.rate/out.metrics.baseline*10)/10,points:points.map(p=>p.pageviews),source:"simulated",reason:out.reason};
  }
  return result;
}
