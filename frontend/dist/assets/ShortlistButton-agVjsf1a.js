import{c as n,r as l,j as t}from"./index-soDQ6FHN.js";import{S as p,s as u}from"./shortlists-BQSAeA5X.js";/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=n("BookmarkPlus",[["path",{d:"m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z",key:"1fy3hk"}],["line",{x1:"12",x2:"12",y1:"7",y2:"13",key:"1cppfj"}],["line",{x1:"15",x2:"9",y1:"10",y2:"10",key:"1gty7f"}]]);/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=n("Check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]]);function y({player:i,compact:d=!1}){const[c,s]=l.useState(!1),[a,r]=l.useState("");function x(e){u(e,i),r(e),s(!1),window.setTimeout(()=>r(""),1800)}return t.jsxs("div",{className:"relative",children:[t.jsxs("button",{type:"button",onClick:e=>{e.preventDefault(),e.stopPropagation(),s(o=>!o)},className:`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 ${d?"w-full":""}`,children:[a?t.jsx(f,{size:13}):t.jsx(h,{size:13}),a||"Save"]}),c&&t.jsx("div",{className:"absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-xl",children:p.map(e=>t.jsx("button",{type:"button",onClick:o=>{o.preventDefault(),o.stopPropagation(),x(e)},className:"block w-full rounded-md px-3 py-2 text-left text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950",children:e},e))})]})}export{f as C,y as S};
