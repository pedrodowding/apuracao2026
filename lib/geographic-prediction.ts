import type {Election} from './election';
import {getMath} from './election';

/** Conditional forecast, NOT a historically calibrated election forecast.
 * Each geographic unit supplies a vote share and estimated valid turnout for its
 * uncounted electorate. Uncertainty is deliberately overdispersed and correlated.
 */
export type Projection={
  status:'closed'|'conditional'|'unavailable';
  leadingName:string;trailingName:string;
  leading:number|null;trailing:number|null;
  reason:string;coverage:number;pending:number;
  projectedGap:number|null;uncertainty:number|null;
  meanFinalVotes:[number,number]|null;
  assumptions:string;
};
const keys=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO','ZZ'];
const erf=(x:number)=>{const sign=x<0?-1:1;const a=Math.abs(x),t=1/(1+.3275911*a);return sign*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-a*a))};
const cdf=(x:number)=>.5*(1+erf(x/Math.SQRT2));
export function geographicProjection(nation:Election|null,places:Record<string,Election>):Projection{
 const names=nation?.candidates||[];
 const base:Projection={status:'unavailable',leadingName:names[0]?.name||'Candidato líder',trailingName:names[1]?.name||'Segundo candidato',leading:null,trailing:null,reason:'Aguardando resultados oficiais.',coverage:keys.filter(k=>Boolean(places[k])).length,pending:0,projectedGap:null,uncertainty:null,meanFinalVotes:null,assumptions:'Modelo condicional com estratificação por 27 UFs e exterior; não foi calibrado com eleições históricas.'};
 if(!nation||names.length!==2)return base;
 const math=getMath(nation);
 if(math?.pendingUpper===0||math?.status.startsWith('irreversível')){
   return {...base,status:'closed',leading:1,trailing:0,reason:'Vitória matematicamente assegurada pelo teto de eleitores pendentes.',pending:math.pendingUpper||0,projectedGap:names[0].votes-names[1].votes,uncertainty:0,meanFinalVotes:[names[0].votes,names[1].votes]};
 }
 if(keys.some(k=>!places[k]))return {...base,reason:'Aguardando as 27 UFs e o exterior para fazer uma projeção geográfica completa.'};
 if(keys.some(k=>places[k].pendingElectors===null||places[k].candidates.length!==2))return {...base,reason:'Há localidades sem eleitorado pendente ou candidatos identificados.'};
 const number0=names[0].number,number1=names[1].number;
 if(!number0||!number1||number0===number1)return {...base,reason:'Identificadores dos candidatos indisponíveis.'};
 let additional0=0,additional1=0,variance=0,remaining=0;
 let counted=0;
 for(const k of keys){
   const e=places[k],pending=e.pendingElectors!;
   const v0=e.candidates.find(c=>c.number===number0)?.votes;
   const v1=e.candidates.find(c=>c.number===number1)?.votes;
   if(v0===undefined||v1===undefined)return {...base,reason:'Incompatibilidade entre identificadores nacionais e locais.'};
   const valid=v0+v1;
   // Missing vote history in a region means its pending votes cannot be forecast safely.
   if(valid===0&&pending>0)return {...base,reason:'Há localidades pendentes sem votos suficientes para uma projeção.'};
   const countedElectors=e.eligible!==null?e.eligible-pending:0;
   if(pending>0&&countedElectors<=0)return {...base,reason:'Comparecimento regional insuficiente para estimar votos restantes.'};
   const validTurnout=countedElectors>0?Math.min(1,valid/countedElectors):0;
   const future=pending*validTurnout;
   const share=(v0+1)/(valid+2);
   additional0+=future*share;additional1+=future*(1-share);
   remaining+=pending;counted+=valid;
   // Uncalibrated 8 p.p. geographic systematic uncertainty plus finite-count uncertainty.
   // Correlation across regions is handled by a global 3 p.p. uncertainty below.
   const localSD=.08*future;
   variance+=(2*localSD)**2 + 4*future*share*(1-share);
 }
 if(remaining===0)return {...base,status:'closed',leading:1,trailing:0,coverage:28,pending:0,projectedGap:names[0].votes-names[1].votes,uncertainty:0,meanFinalVotes:[names[0].votes,names[1].votes],reason:'Todas as abrangências reportam zero eleitores pendentes.'};
 if(counted<1000)return {...base,reason:'Volume apurado ainda insuficiente para estimar a distribuição territorial.'};
 const predicted0=names[0].votes+additional0,predicted1=names[1].votes+additional1;
 const projectedGap=predicted0-predicted1;
 variance+=(2*.03*(additional0+additional1))**2;
 const sd=Math.sqrt(Math.max(variance,1));
 const chance=cdf(projectedGap/sd);
 const prob=Math.max(0,Math.min(1,chance));
 return {...base,status:'conditional',leading:prob,trailing:1-prob,coverage:28,pending:remaining,projectedGap,uncertainty:sd,meanFinalVotes:[predicted0,predicted1],reason:'Estimativa condicional por abrangência. Votos pendentes não constituem amostra aleatória.',assumptions:'Para cada UF e exterior: participação válida futura igual à observada localmente; preferência futura igual à proporção local apurada, com 8 p.p. de incerteza territorial e 3 p.p. de incerteza comum. Normal aproximada sobre a diferença projetada. Parâmetros não calibrados historicamente; não interpretar como probabilidade eleitoral validada.'};
}
