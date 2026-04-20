/* Icons.jsx — Lucide-ish line set used throughout the UI kit.
   Stroke 1.75 / rounded caps / 24x24 box. Single file; each icon a tiny SFC.
*/
const Svg = ({children, size=18, className=''}) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size}
       fill="none" stroke="currentColor" strokeWidth="1.75"
       strokeLinecap="round" strokeLinejoin="round" className={className}>{children}</svg>
);

const I = {
  Home:    (p)=> <Svg {...p}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/></Svg>,
  Tasks:   (p)=> <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h4M7 13h10M7 17h7"/></Svg>,
  Star:    (p)=> <Svg {...p}><polygon points="12 2 15 9 22 10 17 15 18 22 12 19 6 22 7 15 2 10 9 9"/></Svg>,
  Users:   (p)=> <Svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Svg>,
  Contact: (p)=> <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="11" r="3"/><path d="M7 18a5 5 0 0 1 10 0"/></Svg>,
  Share:   (p)=> <Svg {...p}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/></Svg>,
  Chart:   (p)=> <Svg {...p}><path d="M3 3v18h18"/><path d="m7 15 4-4 4 4 5-5"/></Svg>,
  File:    (p)=> <Svg {...p}><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></Svg>,
  Box:     (p)=> <Svg {...p}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05M12 22V12"/></Svg>,
  Brief:   (p)=> <Svg {...p}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></Svg>,
  Bank:    (p)=> <Svg {...p}><path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-8h6v8"/></Svg>,
  Support: (p)=> <Svg {...p}><path d="M3 14v-2a9 9 0 1 1 18 0v2"/><path d="M21 14a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Zm-18 0a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2Z"/></Svg>,
  User:    (p)=> <Svg {...p}><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></Svg>,
  Search:  (p)=> <Svg {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></Svg>,
  Mic:     (p)=> <Svg {...p}><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/></Svg>,
  Plus:    (p)=> <Svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Svg>,
  Bell:    (p)=> <Svg {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Svg>,
  Sparkles:(p)=> <Svg {...p}><path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8Z"/><path d="M19 15l.8 1.9L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-1Z"/></Svg>,
  Filter:  (p)=> <Svg {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></Svg>,
  Upload:  (p)=> <Svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></Svg>,
  Download:(p)=> <Svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Svg>,
  Sort:    (p)=> <Svg {...p}><path d="M7 3v18M3 17l4 4 4-4M17 21V3M21 7l-4-4-4 4"/></Svg>,
  Eye:     (p)=> <Svg {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/></Svg>,
  ChevronDown:(p)=> <Svg {...p}><polyline points="6 9 12 15 18 9"/></Svg>,
  ChevronRight:(p)=> <Svg {...p}><polyline points="9 6 15 12 9 18"/></Svg>,
  X:       (p)=> <Svg {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Svg>,
  Check:   (p)=> <Svg {...p}><polyline points="20 6 9 17 4 12"/></Svg>,
  CheckCircle:(p)=> <Svg {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></Svg>,
  XCircle: (p)=> <Svg {...p}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></Svg>,
  Alert:   (p)=> <Svg {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></Svg>,
  Info:    (p)=> <Svg {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></Svg>,
  MoreV:   (p)=> <Svg {...p}><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></Svg>,
  Calendar:(p)=> <Svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Svg>,
  PanelLeft:(p)=> <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></Svg>,
  Book:    (p)=> <Svg {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></Svg>,
  Video:   (p)=> <Svg {...p}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></Svg>,
  ArrowUp: (p)=> <Svg {...p}><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></Svg>,
  ArrowDown:(p)=> <Svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></Svg>,
  Dot:     (p)=> <span style={{display:'inline-block',width:6,height:6,borderRadius:'50%',background:p?.color||'currentColor',verticalAlign:'middle',marginRight:6}}/>,
  ExtLink: (p)=> <Svg {...p}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></Svg>,
  // Yellow tile + navy "E" glyph — used as company avatar in sidebar
  EtendoMark: ({className='', size=24, radius=6}) => (
    <div className={className} style={{width:size,height:size,borderRadius:radius,background:'linear-gradient(#F8D414,#FFE356)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'inset 0 0 0 1px rgba(0,0,0,.06)',flexShrink:0}}>
      <svg viewBox="0 0 20.241 20" width={size*0.52} height={size*0.52} fill="#202452">
        <path d="M 18.006 15.543 L 13.443 10.003 L 18.198 4.229 L 18.191 4.232 L 19.946 2.102 C 20.636 1.263 20.04 0 18.953 0 L 0.771 0 C 0.345 0 0 0.345 0 0.771 L 0 19.229 C 0 19.655 0.345 20 0.771 20 L 18.952 20 C 20.038 20 20.634 18.737 19.944 17.898 L 18.003 15.541 L 18.006 15.541 L 18.006 15.543 Z M 1.856 18.144 L 1.856 1.856 L 17.74 1.856 L 12.237 8.538 L 10.155 6.734 C 9.911 6.438 9.548 6.266 9.163 6.266 L 5.663 6.266 L 5.663 8.122 L 8.893 8.122 L 11.035 9.997 L 11.038 10.001 L 9.086 11.645 L 5.665 11.645 L 5.665 13.502 L 7.557 13.502 L 9.257 13.502 L 9.355 13.502 C 9.739 13.502 10.104 13.331 10.348 13.033 L 12.24 11.461 L 17.742 18.141 L 1.856 18.141 L 1.856 18.144 Z"/>
      </svg>
    </div>
  ),
};

const Logo = ({size=26, radius=6}) => I.EtendoMark({size, radius});

window.I = I;
window.Logo = Logo;
