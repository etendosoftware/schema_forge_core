// ContactosPage.jsx — Contacts list + empty state + import flow

const contactsSeed = Array.from({length: 14}, (_, i) => {
  const pool = [
    {nombre:'Lucía',  email:'lucia.fernandez@email.com', comercial:'Lucia Fernandez S.A.', tel:'+5493585627161', empresa:'Innova Corp', cargo:'Marketing Manager', pais:'Argentina'},
    {nombre:'Andrés', email:'andres.rojaz@email.com',    comercial:'Rojaz S.A.',            tel:'+5493585627161', empresa:'Data Flow',  cargo:'Gerente',           pais:'España'},
    {nombre:'Sofía',  email:'sofia.gomez@email.com',     comercial:'Gomez Asociados',       tel:'+5493585627161', empresa:'CloudNet',   cargo:'CTO',               pais:'Brasil'},
  ];
  return pool[i%3];
});

const ContactosToolbar = ({tab, setTab, onImport}) => (
  <div className="toolbar">
    <div className="tabs">
      {['Todos','Empresas','Personas'].map(t => (
        <button key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t}</button>
      ))}
    </div>
    <Select icon={<I.Sort size={14}/>} muted>Ordenar A–Z</Select>
    <IconButton variant="secondary" label="filter" icon={<I.Filter size={14}/>}/>
    <div className="spacer"/>
    <IconButton variant="secondary" label="search" icon={<I.Search size={14}/>}/>
    <IconButton variant="secondary" label="import" icon={<I.Upload size={14}/>} onClick={onImport}/>
    <IconButton variant="secondary" label="more" icon={<I.MoreV size={14}/>}/>
    <SplitButton icon={<I.Plus size={12}/>}>Nuevo contacto</SplitButton>
  </div>
);

const ContactosEmpty = ({onImport, onNew}) => (
  <div className="empty">
    <div className="uploadzone" style={{minWidth:280}}>
      <div className="ico"><I.Upload/></div>
      <div className="t">Arrastra tu archivo aquí</div>
      <div className="s">o selecciona un archivo. Formatos compatibles: XLS, CSV o TXT</div>
    </div>
    <div style={{textAlign:'center'}}>
      <h3>Empieza agregando tus contactos</h3>
      <p>Puedes crearlos manualmente o importarlos en segundos</p>
    </div>
    <div className="actions">
      <Button variant="secondary" icon={<I.Sparkles size={14}/>} onClick={onImport}>Pídeselo a Copilot</Button>
      <Button variant="primary" icon={<I.Plus size={12}/>} onClick={onNew}>Nuevo contacto</Button>
    </div>
    <div className="helpstrip" style={{alignSelf:'stretch',maxWidth:560,margin:'24px auto 0'}}>
      <div className="l"><I.Book/> Aprende cómo importar tus contactos de forma rápida y sencilla</div>
      <div className="r">↗ Ver guía</div>
    </div>
  </div>
);

const ContactosTable = ({rows}) => (
  <table className="dtable">
    <thead><tr>
      <th style={{width:24}}><input type="checkbox"/></th>
      <th>Nombre</th><th>Email</th><th>Nombre comercial</th><th>Teléfono</th><th>Empresa</th><th>Cargo</th><th>País</th>
    </tr></thead>
    <tbody>
      {rows.map((r,i)=>(
        <tr key={i}>
          <td><input type="checkbox"/></td>
          <td className="strong">{r.nombre}</td>
          <td>{r.email}</td>
          <td>{r.comercial}</td>
          <td className="num" style={{textAlign:'left'}}>{r.tel}</td>
          <td>{r.empresa}</td>
          <td>{r.cargo}</td>
          <td>{r.pais}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const ImportModal = ({onClose, onConfirm}) => {
  const [step, setStep] = React.useState('map'); // map | confirm | loading | error | done
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (step !== 'loading') return;
    let p = 0;
    const t = setInterval(() => {
      p += 12;
      setProgress(p);
      if (p >= 100) { clearInterval(t); setStep('done'); }
    }, 160);
    return () => clearInterval(t);
  }, [step]);

  const cols = ['Nombre','Email','Nombre comercial','Teléfono','Empresa','No asignado','No asignado'];

  if (step === 'done') { onConfirm(); return null; }

  return (
    <Modal title="Importar contactos" sub="Archivo cargado: contactos.xlsx"
      width={900} onClose={onClose}
      footer={step==='map' ? (
        <>
          <a className="errors-link"><I.Alert size={14}/> 8 Errores encontrados</a>
          <div style={{display:'flex',gap:8}}>
            <Button variant="secondary" onClick={onClose}>Volver</Button>
            <Button variant="primary" onClick={()=>setStep('confirm')}>Importar 112 contactos</Button>
          </div>
        </>
      ) : null}>

      {step === 'map' && (
        <>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
            <Pill variant="info">120 filas detectadas</Pill>
          </div>
          <div className="colmap">
            {cols.map((c,i)=>(
              <div key={i} className="colhead">{c} <I.ChevronDown/></div>
            ))}
          </div>
          <div style={{maxHeight:320,overflow:'auto',border:'1px solid var(--border-1)',borderRadius:8}}>
            <ContactosTable rows={contactsSeed.slice(0,10)}/>
          </div>
        </>
      )}

      {step === 'confirm' && (
        <div style={{padding:'4px 0 16px'}}>
          <h3 style={{margin:'0 0 8px',font:'700 16px/22px var(--font-sans)'}}>Confirmar importación</h3>
          <p style={{margin:'0 0 4px'}}>Se importarán <b>112 contactos</b></p>
          <p style={{margin:'0 0 14px',color:'var(--fg-3)'}}><b>8 filas</b> serán omitidas por errores</p>
          <label style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0'}}>
            <input type="checkbox" defaultChecked/> Crear etiquetas automáticamente
          </label>
          <label style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0'}}>
            <input type="checkbox" defaultChecked/> Evitar duplicados
          </label>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:14}}>
            <Button variant="tertiary" onClick={()=>setStep('map')}>Cancelar</Button>
            <Button variant="primary" onClick={()=>setStep('loading')}>Confirmar importación</Button>
          </div>
        </div>
      )}

      {step === 'loading' && (
        <div style={{padding:'30px 16px 40px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <span style={{font:'600 14px/20px var(--font-sans)',color:'var(--fg-1)'}}>Importando contactos…</span>
            <span style={{font:'500 14px/20px var(--font-mono)',color:'var(--fg-1)'}}>{progress}%</span>
          </div>
          <div className="progress"><i style={{width:`${progress}%`}}/></div>
          <div style={{font:'400 12px/16px var(--font-sans)',color:'var(--fg-3)',marginTop:10}}>Procesando filas</div>
        </div>
      )}
    </Modal>
  );
};

const ContactosPage = ({onToast}) => {
  const [tab, setTab] = React.useState('Todos');
  const [mode, setMode] = React.useState('populated'); // empty | populated
  const [modal, setModal] = React.useState(null); // null | import | error

  return (
    <>
      <ContactosToolbar tab={tab} setTab={setTab} onImport={()=>setModal('import')}/>
      {mode === 'empty'
        ? <ContactosEmpty onImport={()=>setModal('import')} onNew={()=>setMode('populated')}/>
        : <ContactosTable rows={contactsSeed}/>}
      {modal === 'import' && (
        <ImportModal onClose={()=>setModal(null)}
          onConfirm={()=>{ setModal(null); setMode('populated'); onToast('112 contactos importados correctamente','success'); }}/>
      )}
    </>
  );
};

Object.assign(window, {ContactosPage, ImportModal, ContactosEmpty, ContactosTable, ContactosToolbar});
