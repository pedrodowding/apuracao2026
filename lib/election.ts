export type Candidate={name:string,votes:number,percentage:number};
export type Election={uf:string,updated:string,sectionsPercent:number|null,sectionsTotal:number|null,sectionsCounted:number|null,validVotes:number|null,turnout:number|null,eligible:number|null,abstentions:number|null,candidates:Candidate[],source:string};
const num=(v:unknown):number|null=>{if(v===undefined||v===null||v==='')return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)&&n>=0?n:null;};
const pct=(v:unknown):number|null=>{const n=num(v);return n===null?null:n>100&&n<=10000?n/100:n;};
export function parseElection(payload:any,uf:string):Election|null{
 const d=payload?.data;if(!d||!Array.isArray(d.carper))return null;
 const contest=d.carper.find((x:any)=>String(x.cd)==='1')||d.carper[0];
 if(!contest||!Array.isArray(contest.par))return null;
 // EA20: candidates may appear under parties and candidates lists depending on release.
 const raw=contest.par.flatMap((p:any)=>Array.isArray(p.cand)?p.cand:[p]);
 const candidates:Candidate[]=raw.map((x:any)=>({name:String(x.nm||x.n||x.nmue||x.nmu||x.sg||'Candidato'),votes:num(x.vap)??num(x.v)??0,percentage:pct(x.pvap)??pct(x.pv)??0})).filter((x:Candidate)=>x.votes>0).sort((a:Candidate,b:Candidate)=>b.votes-a.votes);
 const sectionsTotal=num(d.s)??num(d.ts)??null;
 const sectionsCounted=num(d.st)??num(d.sj)??null;
 const sectionsPercent=pct(d.pst)??(sectionsTotal!==null&&sectionsCounted!==null&&sectionsTotal>0?100*sectionsCounted/sectionsTotal:null);
 return {uf,updated:String(d.ht||d.dt||payload.receivedAt||''),sectionsPercent,sectionsTotal,sectionsCounted,validVotes:num(d.vv),turnout:num(d.c),eligible:num(d.ea),abstentions:num(d.a),candidates,source:payload.source};
}
export function getMath(e:Election){
 if(e.candidates.length!==2)return null;
 const [leader,other]=e.candidates;
 const lead=leader.votes-other.votes;
 // Maximum remaining VALID ballots is bounded by registered electors, less votes already cast.
 // If absentee / turnout semantics cannot be guaranteed, suppress mathematical claim.
 const pendingUpper=e.eligible!==null&&e.turnout!==null&&e.eligible>=e.turnout?e.eligible-e.turnout:null;
 if(pendingUpper===null)return {lead,pendingUpper:null,status:'indeterminado' as const,minimumShare:null};
 const status=lead>pendingUpper?'irreversível (limite superior)' as const:'reversão matematicamente possível' as const;
 const minimumShare=pendingUpper>0?100*(pendingUpper+lead)/(2*pendingUpper):null;
 return {lead,pendingUpper,status,minimumShare:minimumShare!==null&&minimumShare<=100?minimumShare:null};
}
export const ufNames:Record<string,string>={BR:'Brasil',AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};
export const regions:Record<string,string[]>={Norte:['AC','AP','AM','PA','RO','RR','TO'],Nordeste:['AL','BA','CE','MA','PB','PE','PI','RN','SE'], 'Centro-Oeste':['DF','GO','MT','MS'],Sudeste:['ES','MG','RJ','SP'],Sul:['PR','RS','SC']};
