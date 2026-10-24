// Published, credential-free outputs of the authenticated local AppEEARS pipeline.
if(new URLSearchParams(location.search).get('demo')!=='1' && window.FOREST_REAL_DATA?.records.length){
 const data=window.FOREST_REAL_DATA,rows=data.records.sort((a,b)=>a.year-b.year);
 const good=rows.filter(r=>r.status==='exploratory_estimate');
 let selected=rows.length-1,play=null;
 document.title='中国森林类面积 · AppEEARS实测产品';
 document.querySelector('h1').textContent='中国森林类面积查询';
 document.querySelector('.edition').textContent='遥感分类统计 · 非官方森林覆盖率';
 document.querySelector('.data-notice strong').textContent='真实产品';
 $('region').innerHTML='<option>中国 · 研究范围汇总</option>';
 $('start').innerHTML='<option>'+rows[0].year+'</option>';
 $('end').innerHTML=rows.map(r=>'<option value="'+r.year+'">'+r.year+'</option>').join('');
 $('end').disabled=rows.length<2;
 $('rateMode').textContent='森林类分布';$('changeMode').hidden=true;
 $('resetBtn').disabled=false;
 const metricLabels=document.querySelectorAll('.map-annotation div > span');
 metricLabels[0].textContent='森林类占比';metricLabels[1].textContent='有效数据覆盖';
 $('rate').removeAttribute('data-current');$('delta').removeAttribute('data-current');
 document.querySelector('#trendPanel summary').firstChild.textContent='年度分类占比';
 document.querySelector('.playback-heading span').textContent='真实年度';
 document.querySelector('.playback-panel p').textContent='仅播放已完成年度；过渡不生成新观测';
 $('yearSlider').min=0;$('yearSlider').max=rows.length-1;$('yearSlider').step=1;
 $('yearSlider').disabled=rows.length<2;$('playBtn').disabled=rows.length<2;
 $('sliderStart').textContent=rows[0].year;
 $('mapLegend').innerHTML='<span><i style="background:#20704e"></i>森林类 1—5</span><span><i style="background:#e2e6dc"></i>其他陆地类</span><span><i style="background:#9ec3d6"></i>水体</span>';
 $('mapLegend').classList.add('real-legend');
 document.querySelector('.map-footnote').innerHTML='<span>栅格：NASA MCD12Q1.061 · 近邻降采样仅用于显示</span><span>概化研究边界 · 非标准地图</span>';
 $('sourceDialog').innerHTML='<div class="dialog-head"><h2>真实数据与统计口径</h2><button id="closeApiDialog" aria-label="关闭">×</button></div><p>数据由本地程序通过 NASA AppEEARS 认证提取，下载文件经过 SHA-256 校验。网页展示已发布的统计快照，账户令牌保留在本地。</p><p><strong>森林类占比不是官方森林覆盖率。</strong>本项目将 LC_Type1 的1—5类计为森林类（树高超过2米、树冠覆盖超过60%的分类定义）。分母为研究范围内通过质量筛选的有效分类面积，包含水体；不包含缺失或未分类像元。</p><p>在原生 MODIS 等面积投影中，以像元中心落入边界为准、按仿射变换计算面积。QC 1、3、10及未知值不计入有效面积；8与9保留并单独记录。有效数据覆盖率不是分类准确率。低于99%时不展示主占比。</p><p>统计边界是 geoBoundaries 2019年34个省级单元的合并概化边界，不能等同于官方完整国土边界；未充分表示狭小岛屿及南海岛礁。底图省界来自 DataV，仅帮助定位，不参与面积计算。</p><p><strong>年度分类差异不能直接认定为森林增长或损失。</strong>产品指南不建议以逐年分类差异判定真实土地覆盖变化。2026年完整年度数据未接入。</p><p><a href="https://lpdaac.usgs.gov/documents/1409/MCD12_User_Guide_V61.pdf" target="_blank" rel="noopener">NASA产品指南</a> · <a href="https://www.geoboundaries.org/api/current/gbOpen/CHN/ADM1/" target="_blank" rel="noopener">边界来源</a> · <a href="national-statistics.json" download>下载统计与口径 JSON</a></p>';
 $('closeApiDialog').onclick=()=>$('sourceDialog').close();
 const p=data.pipeline,complete=p.statistics_status==='exploratory_estimate';
 const taskText=complete?'已完成':({queued:'排队中',processing:'处理中',done:'提取完成，统计待完成'}[p.task_status]||p.task_status);
 document.querySelector('.api-details .panel-note').textContent='认证提取：已验证；已生成 '+rows.length+' 个年度。'+p.year+'—'+(p.end_year||p.year)+'任务：'+taskText+'。任务状态快照：'+new Date(p.checked_at).toLocaleString('zh-CN')+'。';
 document.querySelector('footer').innerHTML='<span>MCD12Q1.061 · LC_Type1 + QC · 已生成 '+rows.length+' 个年度</span><span>发布快照 · 原生等面积统计 · 不作真实增减判定</span>';
 const refresh=$('refreshAPI').onclick;
 $('apiStatus').textContent=rows.length+' 个真实年度已生成；'+(complete?'提取统计完成':'历史任务'+taskText);
 $('refreshAPI').onclick=refresh;
 $('exportBtn').disabled=false;
 $('exportBtn').onclick=()=>download(JSON.stringify(data,null,2),'application/json','全国森林类面积-真实产品统计.json');
 $('chartExport').hidden=false;$('chartExport').disabled=false;
 $('chartExport').onclick=()=>download($('trend').innerHTML,'image/svg+xml','年度分类占比.svg');
 function drawTrend(){
  const W=340,H=235,L=42,R=15,T=25,B=38;
  const x=y=>rows.length===1?185:L+(y-rows[0].year)/(rows.at(-1).year-rows[0].year)*(W-L-R);
  const y=v=>H-B-v/30*(H-T-B);
  let s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 235" role="img" aria-label="全国森林类占有效分类面积的年度比例"><rect x="42" y="25" width="283" height="172" fill="#f0f2f4"/>';
  for(const tick of [0,10,20,30])s+='<line x1="42" x2="325" y1="'+y(tick)+'" y2="'+y(tick)+'" stroke="white"/><text x="35" y="'+(y(tick)+4)+'" text-anchor="end" font-size="11" fill="#667580">'+tick+'</text>';
  let pen=false;
  const d=rows.map(r=>{if(r.forest_share_of_valid_classified_area_pct===null){pen=false;return ''}const text=(pen?'L':'M')+x(r.year)+','+y(r.forest_share_of_valid_classified_area_pct);pen=true;return text}).join(' ');
  s+='<path d="'+d+'" stroke="#20704e" stroke-width="2" fill="none"/>';
  for(const r of good){const active=r.year===rows[selected].year;s+='<circle cx="'+x(r.year)+'" cy="'+y(r.forest_share_of_valid_classified_area_pct)+'" r="'+(active?4:2)+'" fill="'+(active?'white':'#20704e')+'" stroke="#20704e"><title>'+r.year+'年 '+r.forest_share_of_valid_classified_area_pct.toFixed(2)+'%</title></circle>'}
  for(const year of [...new Set([rows[0].year,rows[selected].year,rows.at(-1).year])])s+='<text x="'+x(year)+'" y="215" text-anchor="middle" font-size="10" fill="#667580">'+year+'</text>';
  s+='<text x="42" y="15" font-size="10" fill="#506471">森林类占比（%）</text></svg>';
  $('trend').innerHTML=s;
 }
 function renderReal(){
  const r=rows[selected];$('end').value=r.year;$('yearSlider').value=selected;
  $('yearSlider').style.setProperty('--progress',(rows.length>1?selected/(rows.length-1)*100:100)+'%');
  $('sliderYear').textContent=r.year;
  $('mapTitle').textContent=r.year+'年森林类空间分布';
  $('mapSubtitle').textContent='MCD12Q1.061 · LC_Type1 1—5类 · 真实栅格';
  if(r.forest_share_of_valid_classified_area_pct!==null)animateNumber('rate',r.forest_share_of_valid_classified_area_pct,'%');else $('rate').textContent='—';
  animateNumber('delta',r.valid_classified_area_fraction*100,'%');
  $('deltaNote').textContent='森林类面积 '+(r.forest_area_km2/10000).toFixed(2)+' 万km²';
  $('trendSubtitle').textContent=rows.length===1?'仅1个年度，不连接为趋势线':rows[0].year+'—'+rows.at(-1).year+' · 年度分类结果';
  const svg=$('map').querySelector('svg');
  svg.setAttribute('aria-label',r.year+'年真实森林分类分布，非省级覆盖率');svg.querySelector('title').textContent='NASA MCD12Q1森林分类；面积为全国研究范围汇总';
  for(const node of svg.querySelectorAll('g > path.province')){node.setAttribute('fill','none');node.style.stroke='#798887';node.style.strokeWidth='.35';node.style.opacity='.55'}
  const image=document.createElementNS('http://www.w3.org/2000/svg','image');
  for(const [key,v] of Object.entries({x:0,y:0,width:650,height:480,preserveAspectRatio:'none',href:'forest-'+r.year+'.png'}))image.setAttribute(key,v);
  image.classList.add('real-raster');
  svg.insertBefore(image,svg.querySelector('g'));
  const old=svg.querySelectorAll('.real-raster');
  if(old.length>1){if(!reducedMotion.matches)image.animate([{opacity:0},{opacity:1}],{duration:650});for(const node of [...old].slice(0,-1))setTimeout(()=>node.remove(),650)}
  drawTrend();
 }
 function pauseReal(){clearInterval(play);play=null;$('playBtn').textContent='▶';$('playBtn').setAttribute('aria-label','播放年份')}
 $('end').onchange=()=>{pauseReal();selected=rows.findIndex(r=>r.year===Number($('end').value));renderReal()};
 $('yearSlider').oninput=()=>{pauseReal();selected=Number($('yearSlider').value);renderReal()};
 $('playBtn').onclick=()=>{if(play){pauseReal();return}if(selected===rows.length-1)selected=0;renderReal();$('playBtn').textContent='Ⅱ';$('playBtn').setAttribute('aria-label','暂停年份');play=setInterval(()=>{if(selected>=rows.length-1){pauseReal();return}selected++;renderReal()},1400)};
 $('resetBtn').onclick=()=>{pauseReal();selected=rows.length-1;renderReal()};
 renderReal();
}
