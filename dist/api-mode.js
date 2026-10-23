// The public catalogue is accessible without a secret. Account tasks stay local.
if (new URLSearchParams(location.search).get('demo') !== '1') {
 stop();
 document.title='中国全国森林资源 · AppEEARS数据接入';
 document.querySelector('h1').textContent='中国全国森林资源查询';
 document.querySelector('.edition').textContent='AppEEARS · 接入中';
 const notice=document.querySelector('.data-notice');
 notice.innerHTML='<strong>全国汇总</strong><span id="apiStatus">读取产品元数据…</span><button id="refreshAPI">检查公开接口</button><a href="?demo=1">查看界面样品</a>';
 for(const el of document.querySelectorAll('.toolbar select,.toolbar button,#exportBtn,#chartExport,#playBtn,#yearSlider,#sort'))el.disabled=true;
 $('dockToggle').disabled=false;
 $('region').innerHTML='<option>中国 · 全国汇总</option>';
 for(const id of ['start','end'])$(id).innerHTML='<option>待确认</option>';
 $('rate').textContent='—';$('delta').textContent='—';$('regionTitle').textContent='全国';
 $('deltaNote').textContent='未生成真实统计';
 $('mapTitle').textContent='全国研究范围';
 $('mapSubtitle').textContent='仅展示边界 · 尚无森林覆盖统计图层';
 $('map').innerHTML=$('map').innerHTML; // Drop demo click handlers.
 for(const p of $('map').querySelectorAll('path')){
  p.setAttribute('fill','#e0e6ea');p.style.transition='none';p.style.cursor='default';
  p.removeAttribute('tabindex');p.removeAttribute('role');p.removeAttribute('aria-label');
 }
 $('map').querySelector('svg').setAttribute('aria-label','中国研究范围示意，不表示森林覆盖率');
 $('map').querySelector('title').textContent='研究范围边界，暂无统计图层';
 $('mapLegend').textContent='灰色：研究范围，非覆盖比例';
 $('trendSubtitle').textContent='全国 · 等待真实年度数据';
 $('trend').innerHTML='<div class="api-empty"><strong>尚未取得全国统计</strong><p>公开产品接口已接入。账户认证、全国区域提取与面积汇总完成后，才能生成年度曲线。</p></div>';
 $('chartExport').hidden=true;document.querySelector('.plot-caption').hidden=true;
 $('rankingPanel').hidden=true;$('comparison').hidden=true;
 $('sliderStart').textContent='—';$('sliderYear').textContent='—';
 document.querySelector('.playback-panel p').textContent='真实年度序列生成后开放播放';
 document.querySelector('.map-footnote').innerHTML='<span>范围示意边界 · 正式统计边界待核实</span><span>无演示数值参与真实结果</span>';
 document.querySelector('footer').innerHTML='<span>AppEEARS全国接口 · 元数据已接入</span><span>认证任务与全国统计待完成</span>';
 $('sourceDialog').innerHTML='<div class="dialog-head"><h2>数据接入状态</h2><button id="closeApiDialog" aria-label="关闭">×</button></div><p>当前仅连通公开产品与图层接口，没有取得真实全国森林覆盖率。页面中的灰色地图只表示研究范围。</p><p>MCD12Q1从2001年开始，但目录的Present不是最新完整年度。逐年分类差异不宜直接作为真实森林变化；MOD44B树冠覆盖度也不同于森林面积比例。</p><p>下一步在本地程序登录Earthdata，确定正式研究边界、产品和统计口径。密码和令牌不进入网页。</p><p><a href="https://appeears.earthdatacloud.nasa.gov/api/" target="_blank" rel="noopener">NASA API文档</a> · <a href="https://lpdaac.usgs.gov/documents/1409/MCD12_User_Guide_V61.pdf" target="_blank" rel="noopener">产品用户指南</a></p>';
 $('closeApiDialog').onclick=()=>$('sourceDialog').close();
 const details=document.createElement('details');details.open=true;details.className='api-details';
 details.innerHTML='<summary>API连接状态<span class="collapse-symbol"></span></summary><div class="panel-content"><p id="apiChecked"></p><div id="apiProducts"></div><p class="panel-note">账户认证：未验证<br>全国任务：未提交<br>统计结果：未生成</p></div>';
 $('analysisDock').prepend(details);
 function showProducts(products,stamp,live){
  $('apiStatus').textContent=live?'公开产品API实时连接成功':'显示已验证的产品元数据快照';
  $('apiChecked').textContent=(live?'本次检查：':'快照检查：')+stamp;
  $('apiProducts').replaceChildren();
  for(const p of products.filter(p=>['MCD12Q1.061','MOD44B.061'].includes(p.ProductAndVersion))){
   const item=document.createElement('p');
   item.textContent=p.ProductAndVersion+'：'+p.TemporalExtentStart+'起；目录截止标记 '+p.TemporalExtentEnd;
   $('apiProducts').append(item);
  }
 }
 const snapshot=window.APPEEARS_METADATA;
 showProducts(snapshot.products,new Date(snapshot.checked_at).toLocaleString('zh-CN'),false);
 async function refresh(){
  const b=$('refreshAPI');b.disabled=true;b.textContent='连接中…';
  try{
   const r=await fetch('https://appeears.earthdatacloud.nasa.gov/api/product?limit=1000',{signal:AbortSignal.timeout(12000),credentials:'omit'});
   if(!r.ok)throw Error('HTTP '+r.status);
   const products=await r.json();if(!Array.isArray(products))throw Error('Invalid catalogue');
   showProducts(products,new Date().toLocaleString('zh-CN'),true);
  }catch{
   $('apiStatus').textContent='浏览器实时查询未成功；保留已验证元数据快照';
  }finally{b.disabled=false;b.textContent='检查公开接口'}
 }
 $('refreshAPI').onclick=refresh;
} else {
 const link=document.createElement('a');link.href=location.pathname;link.textContent='返回真实数据接入页';document.querySelector('.site-header nav').prepend(link);
}
