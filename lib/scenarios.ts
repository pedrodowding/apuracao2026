import type {Election} from './election';

// Scenario arithmetic only. Not a forecast or a probability of winning.
export type Scenario={share:number,additionalTrailing:number,additionalLeading:number,finalGap:number};
export function scenarioAnalysis(e:Election|null){
 if(!e||e.candidates.length!==2||e.eligible===null||e.turnout===null||e.eligible<e.turnout)return null;
 const remaining=e.eligible-e.turnout;
 const gap=e.candidates[0].votes-e.candidates[1].votes;
 if(!Number.isSafeInteger(remaining)||!Number.isSafeInteger(gap)||remaining<0)return null;
 const shares=[0,25,40,50,60,75,100];
 const scenarios:Scenario[]=shares.map(share=>{
  const trailing=Math.round(remaining*share/100);
  return {share,additionalTrailing:trailing,additionalLeading:remaining-trailing,finalGap:gap+remaining-2*trailing};
 });
 const breakEven=remaining>0?50*(1+gap/remaining):null;
 return {remaining,gap,breakEven,scenarios,mathematicallyClosed:gap>remaining,assumptions:'Cenários extremos: 100% dos eleitores ainda não contabilizados comparecem e produzem votos válidos para um dos dois candidatos. Não incorpora abstenções, brancos, nulos ou ordem geográfica da apuração.'};
}
