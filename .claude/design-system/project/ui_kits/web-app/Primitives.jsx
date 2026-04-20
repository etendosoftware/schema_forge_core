// Primitives.jsx — Button, Pill, Select, Toast, Modal, Card

const Button = ({variant='primary', icon, chev, children, onClick, size, className='', type='button', ...rest}) => (
  <button type={type} onClick={onClick}
    className={`btn ${variant} ${size==='small'?'small':''} ${className}`} {...rest}>
    {icon} {children} {chev && <I.ChevronDown size={12}/>}
  </button>
);

const IconButton = ({icon, onClick, size, label, variant='secondary'}) => (
  <button aria-label={label} onClick={onClick}
    className={`btn ${variant} icon ${size==='small'?'small':''}`}>{icon}</button>
);

const SplitButton = ({icon, children, onClick, onMenu}) => (
  <div className="split-btn">
    <button className="btn primary main" onClick={onClick}>{icon} {children}</button>
    <button className="btn primary chev" onClick={onMenu}><I.ChevronDown size={12}/></button>
  </div>
);

const Pill = ({variant='pending', children}) => (
  <span className={`pill ${variant}`}>{children}</span>
);

const Select = ({icon, children, muted, onClick}) => (
  <button className={`select ${muted?'muted':''}`} onClick={onClick}>
    {icon} <span>{children}</span> <I.ChevronDown size={14}/>
  </button>
);

const Toast = ({variant='success', icon, children, onClose}) => (
  <div className={`toast ${variant}`}>
    {icon || (variant==='success' ? <I.CheckCircle/> : variant==='warn' ? <I.Alert/> : variant==='danger' ? <I.XCircle/> : <I.Info/>)}
    <span>{children}</span>
    {onClose && <button className="x" onClick={onClose}><I.X size={12}/></button>}
  </div>
);

const ToastLayer = ({toasts, onClose}) => (
  <div className="toast-layer">
    {toasts.map(t => <Toast key={t.id} variant={t.variant} onClose={()=>onClose(t.id)}>{t.text}</Toast>)}
  </div>
);

const Modal = ({title, sub, onClose, width=720, children, footer}) => (
  <div className="scrim" onClick={onClose}>
    <div className="modal" style={{width}} onClick={e=>e.stopPropagation()}>
      <div className="mhead">
        <div>
          <h2>{title}</h2>
          {sub && <div className="sub">{sub}</div>}
        </div>
        <button className="btn tertiary icon" onClick={onClose} aria-label="Close"><I.X size={14}/></button>
      </div>
      <div className="mbody">{children}</div>
      {footer && <div className="mfoot">{footer}</div>}
    </div>
  </div>
);

const Card = ({children, className='', ...rest}) => (
  <div className={`card ${className}`} {...rest}>{children}</div>
);

const CardHead = ({eyebrow, right}) => (
  <div className="cd-head">
    <div className="eyebrow">{eyebrow}</div>
    {right}
  </div>
);

Object.assign(window, {Button, IconButton, SplitButton, Pill, Select, Toast, ToastLayer, Modal, Card, CardHead});
