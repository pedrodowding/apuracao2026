import type {Election} from './election';

// Beta(1,1) prior, posterior predictive Beta-Binomial for two candidates.
// A normal approximation is used for very large remaining electorates.
// IMPORTANT: exchangeability of counted and uncounted ballots is an unverified assumption.
function normalCDF(z:number){const x=Math.abs(z)/Math.SQRT2;const t=1/(1+.3275911*x);const erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x);return .5*(1+Math.sign(z)*erf)}
export type WinEstimate={leader:number,trailer:number,remaining:number,shareNeeded:number|null,meanShare:number,interval:[number,number],method:string};
export function probabilityModel(e:Election|null):WinEstimate|null{
 if(!e||e.candidates.length!==2||e.pendingElectors===null)return null;
 const [first,second]=e.candidates;
 const remaining=e.pendingElectors, gap=first.votes-second.votes;
 if(!Number.isSafeInteger(remaining)||remaining<0||first.votes+second.votes<1)return null;
 const alpha=second.votes+1,beta=first.votes+1,ab=alpha+beta;
 const p=alpha/ab;
 if(remaining===0)return {leader:gap>0?1:gap===0?.5:0,trailer:gap>0?0:gap===0?.5:1,remaining,shareNeeded:null,meanShare:p,interval:[p,p],method:'Resultado aritmético: não restam eleitores nas seções pendentes.'};
 if(gap>remaining)return {leader:1,trailer:0,remaining,shareNeeded:50*(1+gap/remaining)/100,meanShare:p,interval:[p,p],method:'Fechamento matemático: nem todos os eleitores pendentes poderiam reverter a diferença.'};
 const mean=remaining*p;
 const variance=remaining*p*(1-p)*(ab+remaining)/(ab+1);
 const sd=Math.sqrt(variance);
 const threshold=(remaining+gap)/2;
 const z=sd>0?(threshold+.5-mean)/sd:0;
 const trailing=sd>0?Math.max(0,Math.min(1,1-normalCDF(z))):(mean>threshold?1:0);
 const shareSd=Math.sqrt(p*(1-p)/(ab+1));
 return {leader:1-trailing,trailer:trailing,remaining,shareNeeded:threshold/remaining,meanShare:p,interval:[Math.max(0,p-1.96*shareSd),Math.min(1,p+1.96*shareSd)],method:'Modelo condicional Beta-Binomial (prior uniforme), com aproximação normal para a distribuição preditiva.'};
}
