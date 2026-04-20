// FacturasPage.jsx — Invoices (Ventas / Compras)

const facturasSeed = [
  {fecha:'08/04/2026', num:'I260001', venc:{color:'#F2CB00', date:'09/03/2026'}, cliente:'Etendo Software S.A.',     desc:'Servicio de consultoría', tag:'GT709', cuenta:'Servicios reconocido…', sub:'324.000,00', total:'624.000,00', estado:'Pendiente'},
  {fecha:'12/05/2026', num:'I259999', venc:{color:'#1E7A47', date:'23/03/2026'}, cliente:'—',                         desc:'',                        tag:'',     cuenta:'',                       sub:'9.000,00',   total:'3.009,00',    estado:'Pendiente'},
  {fecha:'01/03/2026', num:'I257952', venc:{color:'#D50B3E', date:'15/01/2026'}, cliente:'Restaurante Luna Llena Cordoba S.A.', desc:'Servicio de transporte', tag:'', cuenta:'',            sub:'756.000,00', total:'983.000,00',  estado:'Pendiente'},
];

const FacturasToolbar = ({filtered, onSaveFilter}) => (
  <div className="toolbar">
    <Select icon={<I.ChevronDown size={14}/>}>Todos los estados</Select>
    <Select icon={<I.Calendar size={14}/>}>Últimos 12 meses</Select>
    <div className="filter-pill">
      <IconButton variant="secondary" label="filter" icon={<I.Filter size={14}/>}/>
      {filtered && <span className="dot">1</span>}
    </div>
    <div className="spacer"/>
    <IconButton variant="secondary" label="search" icon={<I.Search size={14}/>}/>
    <IconButton variant="secondary" label="import" icon={<I.Upload size={14}/>}/>
    <IconButton variant="secondary" label="sort" icon={<I.Sort size={14}/>}/>
    <button className="btn secondary" onClick={onSaveFilter}><I.Eye size={14}/> 12</button>
    <SplitButton icon={<I.Plus size={12}/>}>Nueva factura</SplitButton>
  </div>
);

const FacturasTable = ({rows, showEstado}) => (
  <table className="dtable">
    <thead><tr>
      <th style={{width:24}}><input type="checkbox"/></th>
      <th>Fecha</th><th>Nº</th><th>Vencimiento</th><th>Cliente</th><th>Descripción</th><th>Tags</th><th>Cuenta</th>
      <th className="num">Subtotal</th><th className="num">Total</th>
      {showEstado && <th>Estado</th>}
    </tr></thead>
    <tbody>
      {rows.map((r,i)=>(
        <tr key={i}>
          <td><input type="checkbox"/></td>
          <td className="strong">{r.fecha}</td>
          <td style={{fontFamily:'var(--font-mono)'}}>{r.num}</td>
          <td><span style={{display:'inline-block',width:6,height:6,borderRadius:'50%',background:r.venc.color,marginRight:6,verticalAlign:'middle'}}/>{r.venc.date}</td>
          <td>{r.cliente}</td>
          <td>{r.desc}</td>
          <td>{r.tag && <span className="tag">{r.tag} <span className="x">×</span></span>}</td>
          <td>{r.cuenta && <span className="tag" style={{background:'var(--info-bg)',color:'var(--info-fg)',borderColor:'var(--info-border)'}}>{r.cuenta}</span>}</td>
          <td className="num strong">${r.sub}</td>
          <td className="num strong">${r.total}</td>
          {showEstado && <td><Pill variant="pending">{r.estado}</Pill></td>}
        </tr>
      ))}
      <tr>
        <td colSpan={8}></td>
        <td className="num strong">${'$'}{rows.reduce((s,r)=>s+parseFloat(r.sub.replace(/\./g,'').replace(',','.')),0).toLocaleString('de-DE',{minimumFractionDigits:2})}</td>
        <td className="num strong">${'$'}{rows.reduce((s,r)=>s+parseFloat(r.total.replace(/\./g,'').replace(',','.')),0).toLocaleString('de-DE',{minimumFractionDigits:2})}</td>
        {showEstado && <td></td>}
      </tr>
    </tbody>
  </table>
);

const FacturasVentaPage = ({onToast}) => {
  const [filtered, setFiltered] = React.useState(false);
  const rows = filtered ? facturasSeed.slice(0,1) : facturasSeed;
  return (
    <>
      <FacturasToolbar filtered={filtered} onSaveFilter={()=>{setFiltered(true); onToast('Filtro guardado correctamente','success');}}/>
      <FacturasTable rows={rows} showEstado={filtered}/>
    </>
  );
};

const FacturasCompraPage = () => (
  <div className="empty" style={{paddingTop:80}}>
    <div className="uploadzone" style={{minWidth:280}}>
      <div className="ico"><I.Upload/></div>
      <div className="t">Arrastra una factura aquí</div>
      <div className="s">o selecciona un archivo</div>
    </div>
    <div style={{textAlign:'center'}}>
      <h3>Aún no tienes facturas de compra</h3>
      <p>Registra las facturas de tus proveedores para controlar tus gastos<br/>y mantener tu contabilidad organizada.</p>
    </div>
    <div className="actions">
      <Button variant="secondary" icon={<I.Sparkles size={14}/>}>Pídesela a Copilot</Button>
      <Button variant="primary" icon={<I.Plus size={12}/>}>Nueva compra</Button>
    </div>
    <div className="helpstrip" style={{alignSelf:'stretch',maxWidth:560,margin:'24px auto 0'}}>
      <div className="l"><I.Book/> Aprende a crear una factura en 3 minutos</div>
      <div className="r"><I.Video size={14}/> Video tutorial</div>
    </div>
  </div>
);

Object.assign(window, {FacturasVentaPage, FacturasCompraPage});
