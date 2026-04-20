// Shell.jsx — AppShell, Topbar, IconRail, SideNav

const Topbar = ({title, count, breadcrumb, onToggleSide, onOpenCopilot}) => (
  <header className="topbar">
    <button className="icn" onClick={onToggleSide} aria-label="Toggle sidebar">
      <I.PanelLeft/>
    </button>
    <div className="pagehead">
      <div className="stack">
        <h1>{title}{count != null && <span className="count">{count}</span>}<I.MoreV className="muted"/></h1>
        {breadcrumb && <div className="breadcrumb">{breadcrumb}</div>}
      </div>
    </div>
    <div className="search">
      <I.Search size={16}/>
      <input placeholder="Buscar clientes, pedidos, facturas…"/>
      <I.Mic size={16}/>
    </div>
    <div className="actions">
      <button className="icn" onClick={onOpenCopilot} aria-label="Copilot"><I.Sparkles/></button>
      <button className="icn" aria-label="New"><I.Plus/></button>
      <button className="icn" aria-label="Notifications"><I.Bell/></button>
    </div>
  </header>
);

const IconRail = ({active, onPick}) => {
  // Order and icons match Figma /Components/Navigation/Icon Rail.
  const items = [
    {id:'primeros',  icon:<I.Check/>,   label:'Primeros pasos'},
    {id:'inicio',    icon:<I.Home/>,    label:'Inicio'},
    {id:'fav',       icon:<I.Star/>,    label:'Favoritos'},
    {id:'contactos', icon:<I.Contact/>, label:'Contactos'},
    {id:'crm',       icon:<I.Share/>,   label:'CRM'},
    {id:'ventas',    icon:<I.Chart/>,   label:'Ventas'},
    {id:'facturas-venta',icon:<I.File/>,label:'Facturas de venta'},
    {id:'pedidos',   icon:<I.Box/>,     label:'Pedidos'},
    {id:'pres',      icon:<I.Brief/>,   label:'Presupuestos'},
    {id:'fin',       icon:<I.Bank/>,    label:'Finanzas'},
  ];
  return (
    <nav className="rail">
      {items.map(it => (
        <button key={it.id} className={`slot ${active===it.id?'active':''}`}
                onClick={()=>onPick(it.id)} aria-label={it.label} title={it.label}>
          {it.icon}
        </button>
      ))}
      <div className="divider"/>
      <button className="slot" aria-label="Ayuda"><I.Support/></button>
      <button className="slot" aria-label="Cuenta"><I.User/></button>
    </nav>
  );
};

const SideNav = ({active, onPick}) => {
  const row = (id, icon, label, extra) => (
    <button key={id} className={`navrow ${active===id?'active':''}`} onClick={()=>onPick(id)}>
      {icon} <span>{label}</span> {extra}
    </button>
  );
  return (
    <aside className="sidenav">
      <div className="company">
        <I.EtendoMark className="logo"/>
        <div className="name">Tu empresa</div>
        <I.ChevronDown size={14} className="chev"/>
      </div>
      <div className="section">General</div>
      {row('primeros', <I.Check/>, 'Primeros pasos')}
      {row('inicio',   <I.Home/>, 'Inicio')}
      {row('fav',      <I.Star/>, 'Favoritos', <I.ChevronDown size={14} className="caret"/>)}
      <div className="subrow">Cuentas</div>
      <div className="subrow">Pagos y cobros</div>
      <div className="subrow" style={{color:'var(--fg-3)'}}>+3 más</div>

      <div className="section">Comercial</div>
      {row('contactos',<I.Contact/>, 'Contactos')}
      {row('crm',      <I.Share/>, 'CRM', <I.ChevronDown size={14} className="caret"/>)}
      {row('ventas',   <I.Chart/>, 'Ventas', <I.ChevronDown size={14} className="caret"/>)}
      <div className={`subrow ${active==='facturas-venta'?'active':''}`} onClick={()=>onPick('facturas-venta')}>Facturas</div>
      <div className="subrow">Presupuestos</div>
      <div className="subrow">Servicios</div>

      <div className="bottom">
        <div className="section">&nbsp;</div>
        {row('ayuda', <I.Support/>, 'Ayuda y soporte', <I.ChevronRight size={14} className="caret"/>)}
        {row('user',  <I.User/>, 'Jhon Doe', <I.ChevronRight size={14} className="caret"/>)}
      </div>
    </aside>
  );
};

const AppShell = ({active, onPick, expanded, onToggleSide, title, count, breadcrumb, children, onOpenCopilot}) => (
  <div className={`app ${expanded?'expanded':''}`}>
    <Topbar title={title} count={count} breadcrumb={breadcrumb} onToggleSide={onToggleSide} onOpenCopilot={onOpenCopilot}/>
    {expanded ? <SideNav active={active} onPick={onPick}/> : <IconRail active={active} onPick={onPick}/>}
    <main className="main"><div className="page">{children}</div></main>
  </div>
);

Object.assign(window, {Topbar, IconRail, SideNav, AppShell});
