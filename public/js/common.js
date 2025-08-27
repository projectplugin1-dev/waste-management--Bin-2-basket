async function api(path, opts={}){
  const res = await fetch(path, { headers: { 'Content-Type':'application/json' }, credentials:'same-origin', ...opts });
  if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || 'Request failed');
  return res.json();
}

async function getSession(){
  try{ const me = await api('/api/auth/me'); return me.user || null }catch{return null}
}

function formatCurrency(v){
  return new Intl.NumberFormat(undefined, { style:'currency', currency:'USD' }).format(Number(v||0));
}

window.B2B = { api, getSession, formatCurrency };

