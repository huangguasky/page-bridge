import { useEffect, useState, type DragEvent } from 'react'
import EbookReader from './EbookReader'

type View = 'home' | 'kindle' | 'phone' | 'reader' | 'settings'
const basename = (p: string) => p.split(/[\\/]/).pop() || p
const fmt = (n: number) => n < 1048576 ? `${(n/1024).toFixed(1)} KB` : `${(n/1048576).toFixed(1)} MB`

export default function App() {
  const [view, setView] = useState<View>('home')
  const [config, setConfig] = useState<SmtpConfig | null>(null)
  const bridge = window.pageBridge
  useEffect(() => { if (bridge) bridge.getConfig().then(setConfig) }, [bridge])
  if (!bridge) return <div className="browser-warning"><h1>请在 Page Bridge 客户端中打开</h1><p>这个地址是桌面界面的开发服务，直接使用浏览器访问时无法调用本地文件和邮件功能。</p></div>
  return <div className="app">
    <aside><div className="brand"><span>PB</span><b>Page Bridge</b></div><nav>
      <button className={view==='home'?'active':''} onClick={()=>setView('home')}>⌂<span>首页</span></button>
      <button className={view==='kindle'?'active':''} onClick={()=>setView(config?'kindle':'settings')}>▣<span>传输到 Kindle</span></button>
      <button className={view==='phone'?'active':''} onClick={()=>setView('phone')}>▯<span>传输到手机</span></button>
      <button className={view==='reader'?'active':''} onClick={()=>setView('reader')}>▤<span>电子书预览</span></button>
    </nav><p className="version">安全 · 本地 · 简单</p></aside>
    <main>{view === 'home' && <Home go={v=>setView(v==='kindle'&&!config?'settings':v)} />}
      {view === 'settings' && <Settings initial={config} onSaved={c=>{setConfig(c);setView('kindle')}} onBack={()=>setView(config?'kindle':'home')} />}
      {view === 'kindle' && config && <Kindle config={config} edit={()=>setView('settings')} />}
      {view === 'phone' && <Phone />}
      {view === 'reader' && <EbookReader />}
    </main>
  </div>
}

function Home({go}:{go:(v:View)=>void}) { return <section className="home"><div className="eyebrow">文件传输助手</div><h1>想把文件传到哪里？</h1><p className="lead">无需数据线，在电脑、Kindle 和手机之间轻松传递。</p><div className="choices">
  <button className="choice kindle" onClick={()=>go('kindle')}><i>▣</i><div><h2>传输到 Kindle</h2><p>通过电子邮件发送书籍，稍后即可在 Kindle 中阅读</p><span>开始传输 →</span></div></button>
  <button className="choice phone" onClick={()=>go('phone')}><i>▯</i><div><h2>传输到手机</h2><p>通过同一 Wi-Fi 高速传输，不经过云端服务器</p><span>开始传输 →</span></div></button>
  </div><div className="privacy"><b>隐私优先</b><span>配置仅保存在这台电脑；手机传输只在局域网内进行。</span></div></section> }

function Settings({initial,onSaved,onBack}:{initial:SmtpConfig|null,onSaved:(c:SmtpConfig)=>void,onBack:()=>void}) {
  const [form,setForm] = useState<SmtpConfig>(initial ?? {host:'smtp.qq.com',port:465,secure:true,username:'',password:'',from:'',recipients:[]})
  const [emails,setEmails] = useState(initial?.recipients.join('\n') ?? '')
  const [error,setError] = useState('')
  const save=async()=>{const recipients=emails.split(/[\n,;]/).map(x=>x.trim()).filter(Boolean);if(!form.host||!form.port||!form.username||!form.password||!recipients.length){setError('请完整填写 SMTP 服务和至少一个 Kindle 邮箱');return}const next={...form,from:form.from||form.username,recipients};await window.pageBridge.saveConfig(next);onSaved(next)}
  return <section><Top title="Kindle 邮件配置" sub="仅需配置一次，之后拖入书籍即可发送" back={onBack}/><div className="settings-grid"><div className="panel form"><h3>SMTP 发件服务</h3><label>服务器地址<input value={form.host} onChange={e=>setForm({...form,host:e.target.value})} placeholder="smtp.example.com"/></label><div className="row"><label>端口<input type="number" value={form.port} onChange={e=>setForm({...form,port:+e.target.value})}/></label><label className="check"><input type="checkbox" checked={form.secure} onChange={e=>setForm({...form,secure:e.target.checked})}/>使用 SSL/TLS</label></div><label>发件邮箱<input value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></label><label>SMTP 授权码<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="通常不是邮箱登录密码"/></label><label>Kindle 目标邮箱（每行一个）<textarea rows={3} value={emails} onChange={e=>setEmails(e.target.value)} placeholder="name_xxx@kindle.com"/></label>{error&&<p className="error">{error}</p>}<button className="primary" onClick={save}>保存并继续</button></div>
  <div className="guide"><h3>在哪里找到 Kindle 邮箱？</h3><ol><li>打开亚马逊网站的「管理我的内容和设备」</li><li>进入「首选项」→「个人文档设置」</li><li>找到“发送至 Kindle”电子邮箱地址</li></ol><h3>别忘了添加白名单</h3><p>在同一页面的「已认可的发件人电子邮箱列表」中，添加左侧填写的发件邮箱，否则亚马逊会拒收邮件。</p><a href="https://www.amazon.com/hz/mycd/myx#/home/settings/payment" target="_blank" rel="noreferrer">打开亚马逊内容与设备设置 ↗</a><small>不同地区的亚马逊页面名称可能略有差异。</small></div></div></section>
}

function Kindle({config,edit}:{config:SmtpConfig,edit:()=>void}) {
 const [files,setFiles]=useState<string[]>([]),[selected,setSelected]=useState(config.recipients),[state,setState]=useState(''),[sending,setSending]=useState(false),[dragging,setDragging]=useState(false)
 const pick=async()=>{if(!sending)setFiles(await window.pageBridge.pickFiles(true))}
 const drop=(e:DragEvent)=>{e.preventDefault();setDragging(false);if(sending)return;const paths=Array.from(e.dataTransfer.files).map(file=>window.pageBridge.getPathForFile(file)).filter(Boolean);if(paths.length)setFiles(paths)}
 const send=async()=>{if(!files.length||sending)return;setSending(true);setState('正在连接邮件服务器并发送…');try{await window.pageBridge.sendKindle(files,selected);setState('发送成功！Kindle 送达通常需要几分钟，请稍后刷新书库。');setFiles([])}catch(e){setState(`发送失败：${e instanceof Error?e.message:String(e)}`)}finally{setSending(false)}}
 return <section><Top title="传输到 Kindle" sub="支持 EPUB、PDF、DOCX、TXT 和常见图片格式"/><div className="toolbar"><button className="link" disabled={sending} onClick={edit}>⚙ 修改邮件配置</button></div><div className={`drop ${dragging?'dragging':''}`} onClick={pick} onDragEnter={e=>{e.preventDefault();setDragging(true)}} onDragOver={e=>e.preventDefault()} onDragLeave={()=>setDragging(false)} onDrop={drop}><div className="drop-icon">＋</div><h3>{files.length?`已选择 ${files.length} 个文件`:'点击选择或拖入书籍文件'}</h3><p>也可一次选择多个文件 · 单封邮件大小受邮箱服务商限制</p></div>{files.length>0&&<div className="panel list">{files.map((f,i)=><div className="file-row" key={f}><span>📄</span><b>{basename(f)}</b><button disabled={sending} onClick={()=>setFiles(files.filter((_,x)=>x!==i))}>移除</button></div>)}<h4>发送到</h4>{config.recipients.map(x=><label className="recipient" key={x}><input type="checkbox" disabled={sending} checked={selected.includes(x)} onChange={e=>setSelected(e.target.checked?[...selected,x]:selected.filter(y=>y!==x))}/>{x}</label>)}<button className="primary" disabled={!selected.length||sending} onClick={send}>{sending?'正在发送，请稍候…':'发送到 Kindle'}</button></div>}{state&&<div className={state.startsWith('发送失败')?'notice bad':'notice'}>{state}</div>}</section>
}

function Phone() {
 const [files,setFiles]=useState<string[]>([]),[share,setShare]=useState<ShareInfo|null>(null),[error,setError]=useState(''),[starting,setStarting]=useState(false),[dragging,setDragging]=useState(false)
 useEffect(()=>()=>{window.pageBridge.stopShare()},[])
 const pick=async()=>{if(starting)return;await window.pageBridge.stopShare();setShare(null);setFiles(await window.pageBridge.pickFiles(false))}
 const drop=(e:DragEvent)=>{e.preventDefault();setDragging(false);if(starting)return;const paths=Array.from(e.dataTransfer.files).map(file=>window.pageBridge.getPathForFile(file)).filter(Boolean);if(paths.length)setFiles(paths)}
 const start=async()=>{if(starting||!files.length)return;setStarting(true);setError('');try{setShare(await window.pageBridge.startShare(files))}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setStarting(false)}}; const stop=async()=>{await window.pageBridge.stopShare();setShare(null)}
 return <section><Top title="传输到手机" sub="电脑和手机需要连接同一个 Wi-Fi"/>{!share?<><div className={`drop phone-drop ${dragging?'dragging':''}`} onClick={pick} onDragEnter={e=>{e.preventDefault();setDragging(true)}} onDragOver={e=>e.preventDefault()} onDragLeave={()=>setDragging(false)} onDrop={drop}><div className="drop-icon">＋</div><h3>{files.length?`已选择 ${files.length} 个文件`:'点击选择或拖入要发送的文件'}</h3><p>不限格式，文件不会上传到互联网</p></div>{files.length>0&&<div className="panel list">{files.map(f=><div className="file-row" key={f}><span>📎</span><b>{basename(f)}</b></div>)}<button className="primary" disabled={starting} onClick={start}>{starting?'正在建立共享通道…':'建立临时共享通道'}</button></div>}</>:<div className="share panel"><div><div className="live">● 正在共享</div><h2>用手机扫描二维码</h2><p>或在手机浏览器输入以下地址：</p><code>{share.url}</code><p className="muted">手机点击下载后，文件会通过当前 Wi-Fi 直接传输。请保持此窗口打开。</p><button className="danger" onClick={stop}>结束共享</button></div><img src={share.qrDataUrl} alt="手机接收地址二维码"/></div>}{error&&<p className="error">{error}</p>}</section>
}

function Top({title,sub,back}:{title:string,sub:string,back?:()=>void}) {return <header className="top">{back&&<button onClick={back}>←</button>}<div><h1>{title}</h1><p>{sub}</p></div></header>}
