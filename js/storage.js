/* All personal inputs stay in browser storage. No accounts, analytics, or server writes. */
const KEY='fieldnotes-career-atlas-v1';
export const initialState=()=>({completed:{},ratings:{},weights:{},favorites:{},notes:'',finances:{hourly:27,hours:35,weeks:48,expenses:3200,savings:12000},compareA:'heritage',compareB:'auction'});
export function loadState(){
  try { const value=JSON.parse(localStorage.getItem(KEY)||'null');return value&&typeof value==='object'&&!Array.isArray(value)?{...initialState(),...value}:initialState(); }
  catch { return initialState(); }
}
export function saveState(value){try{localStorage.setItem(KEY,JSON.stringify(value));return true}catch{return false}}
export function cleanImported(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected a JSON object.');
  const allowed=['completed','ratings','weights','favorites','notes','finances','compareA','compareB'];
  const result=initialState();
  for(const key of allowed) if(Object.hasOwn(value,key)){
    if(['completed','ratings','weights','favorites','finances'].includes(key)){
      if(value[key]&&typeof value[key]==='object'&&!Array.isArray(value[key]))result[key]=value[key];
    } else if(typeof value[key]==='string')result[key]=value[key].slice(0,key==='notes'?20000:100);
  }
  return result;
}
export function downloadJSON(filename,object){
  const data=new Blob([JSON.stringify(object,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(data),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
}
