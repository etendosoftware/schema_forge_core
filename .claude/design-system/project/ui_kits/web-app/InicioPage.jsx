// InicioPage.jsx — Home dashboard

const taskCards = [
  {label:'Ventas', num:'3', pill:{variant:'danger', text:'Facturas vencidas'}, icon:<I.Chart/>},
  {label:'Compras', num:'1', pill:{variant:'warn', text:'Sin conciliar'}, icon:<I.File/>},
  {label:'Pedidos', num:'2', pill:{variant:'success', text:'Pendiente de envío'}, icon:<I.Box/>},
  {label:'Presupuestos', num:'1', pill:{variant:'info', text:'Pendiente'}, icon:<I.Brief/>},
];

const quickAccess = ['Facturas de compra','Facturas de venta','Contactos','Presupuestos'];

const topClients = [
  {name:'Grupo Martínez S.L.', amount:'5.172.697,08 EUR'},
  {name:'Comercial Vega S.A.', amount:'3.374.837,18 EUR'},
  {name:'Distribuciones Luna', amount:'1.465.294,40 EUR'},
  {name:'Importadora Solís',   amount:'746.103,02 EUR'},
  {name:'Alimentos del Norte', amount:'74.028,56 EUR'},
];

const recentSales = [
  {client:'Grupo Martínez S.L.', id:'SO-10458', amt:'EUR 4.850'},
  {client:'Comercial Vega S.A.', id:'SO-10457', amt:'EUR 3.920'},
  {client:'Distribuciones Luna', id:'SO-10456', amt:'EUR 2.740'},
  {client:'Importadora Solís',   id:'SO-10455', amt:'EUR 6.120'},
];

const InicioPage = () => (
  <div>
    {/* greeting strip */}
    <Card className="mb-4" style={{background:'#fff'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',gap:12,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:32,height:32,borderRadius:8,background:'var(--bg-subtle)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <I.Tasks size={16}/>
          </div>
          <div>
            <div style={{font:'400 12px/16px var(--font-sans)',color:'var(--fg-3)'}}>Hola, Jhon Doe</div>
            <div style={{font:'700 18px/24px var(--font-sans)',color:'var(--fg-1)'}}>Estas son tus tareas pendientes</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <Select icon={<I.Calendar size={14}/>}>Último año</Select>
          <Button variant="primary" icon={<I.Sparkles size={14}/>}>¿En qué te puedo ayudar hoy?</Button>
        </div>
      </div>
    </Card>

    {/* top row: task cards + quick access + top clients */}
    <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.6fr) minmax(0,.9fr) minmax(0,1.2fr)',gap:12,marginBottom:12}}>
      <Card>
        <CardHead eyebrow="Tareas pendientes" right={
          <div style={{display:'flex',gap:4}}>
            <IconButton variant="secondary" size="small" label="prev" icon={<I.ChevronRight size={12} style={{transform:'rotate(180deg)'}}/>}/>
            <IconButton variant="secondary" size="small" label="next" icon={<I.ChevronRight size={12}/>}/>
          </div>
        }/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,padding:'0 14px 14px'}}>
          {taskCards.map((t,i)=>(
            <div key={i} style={{border:'1px solid var(--border-1)',borderRadius:10,padding:12,background:'#fff'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',color:'var(--fg-3)'}}>
                {t.icon}
                <span style={{font:'500 11px/14px var(--font-sans)',color:'var(--fg-3)'}}>{t.label}</span>
              </div>
              <div style={{font:'700 28px/32px var(--font-sans)',color:'var(--fg-1)',marginTop:10,letterSpacing:'-0.02em'}}>{t.num}</div>
              <div style={{marginTop:8}}><Pill variant={t.pill.variant}>{t.pill.text}</Pill></div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHead eyebrow="Accesos rápidos"/>
        <div style={{padding:'0 14px 14px',display:'flex',flexDirection:'column',gap:4}}>
          {quickAccess.map((q,i)=>(
            <div key={i} className="hover-row" style={{display:'flex',alignItems:'center',gap:10,padding:'7px 10px',borderRadius:8,cursor:'pointer'}}>
              <I.ChevronRight size={14} style={{color:'var(--fg-4)'}}/>
              <span style={{font:'500 13px/18px var(--font-sans)',color:'var(--fg-1)'}}>{q}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHead eyebrow="Clientes destacados"/>
        <div style={{padding:'0 14px 14px',display:'flex',flexDirection:'column'}}>
          {topClients.map((c,i)=>(
            <div key={i} className="hover-row" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'8px 10px',borderRadius:8,cursor:'pointer',borderTop:i?'1px solid var(--border-1)':'none'}}>
              <span style={{font:'500 13px/18px var(--font-sans)',color:'var(--fg-1)'}}>{c.name}</span>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span className="pill info" style={{fontFamily:'var(--font-mono)'}}>{c.amount}</span>
                <I.ChevronRight size={14} style={{color:'var(--fg-4)'}}/>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>

    {/* financial summary + recent sales + cobros */}
    <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.6fr) minmax(0,1.2fr) minmax(0,.9fr)',gap:12}}>
      <Card>
        <CardHead eyebrow="Resumen financiero" right={<I.ExtLink size={14} style={{color:'var(--fg-3)'}}/>}/>
        <div style={{padding:'0 16px 16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,color:'var(--success-fg)',font:'500 12px/16px var(--font-sans)',marginBottom:8}}>
            <I.CheckCircle size={14}/> Tus ingresos superaron a los gastos este año
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginTop:10}}>
            {[
              {label:'Ingresos', v:'EUR 12.4M', delta:'+8% vs año anterior', up:true},
              {label:'Gastos',   v:'EUR 8.2M',  delta:'−3% vs año anterior', up:false},
              {label:'Beneficio',v:'EUR 4.2M',  delta:'+12% vs año anterior', up:true},
            ].map((m,i)=>(
              <div key={i}>
                <div style={{font:'400 12px/16px var(--font-sans)',color:'var(--fg-3)'}}>{m.label}</div>
                <div className="display" style={{fontSize:32,lineHeight:'40px',marginTop:2}}>{m.v}</div>
                <div style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:4,font:'500 11px/14px var(--font-sans)',color:m.up?'var(--success-fg)':'var(--danger-fg)'}}>
                  {m.up?<I.ArrowUp size={12}/>:<I.ArrowDown size={12}/>} {m.delta}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
      <Card>
        <CardHead eyebrow="Ventas recientes"/>
        <div style={{padding:'0 14px 14px',display:'flex',flexDirection:'column'}}>
          {recentSales.map((s,i)=>(
            <div key={i} className="hover-row" style={{display:'grid',gridTemplateColumns:'1.6fr .8fr .8fr auto',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:8,borderTop:i?'1px solid var(--border-1)':'none'}}>
              <span style={{font:'500 13px/18px var(--font-sans)',color:'var(--fg-1)'}}>{s.client}</span>
              <span style={{font:'400 12px/16px var(--font-mono)',color:'var(--fg-3)'}}>{s.id}</span>
              <span className="pill info" style={{justifySelf:'end',fontFamily:'var(--font-mono)'}}>{s.amt}</span>
              <I.ChevronRight size={14} style={{color:'var(--fg-4)'}}/>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHead eyebrow="Cobros y pagos"/>
        <div style={{padding:'0 16px 16px',display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <span style={{font:'500 13px/18px var(--font-sans)',color:'var(--fg-1)'}}>Por cobrar</span>
              <span className="count" style={{padding:'1px 6px',borderRadius:999,background:'var(--bg-subtle)',font:'600 11px/14px var(--font-sans)',color:'var(--fg-3)'}}>7</span>
            </div>
            <span className="pill success">EUR 478.580,48</span>
          </div>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <span style={{font:'500 13px/18px var(--font-sans)',color:'var(--fg-1)'}}>Por pagar</span>
              <span className="count" style={{padding:'1px 6px',borderRadius:999,background:'var(--bg-subtle)',font:'600 11px/14px var(--font-sans)',color:'var(--fg-3)'}}>1</span>
            </div>
            <span className="pill danger">EUR 5,00</span>
          </div>
        </div>
      </Card>
    </div>
  </div>
);

window.InicioPage = InicioPage;
