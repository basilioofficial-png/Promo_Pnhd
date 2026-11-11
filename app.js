const $=id=>document.getElementById(id),money=v=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(v);const palette={'Чёрный':'#282924','Белый':'#ffffff','Горчичный':'#b19742','Тёмно-зелёный':'#34493c','Синий':'#315b91','Тёмно-синий':'#283345','Молочный':'#e6e2d4','Меланж':'#a8aaa5','Небесно-голубой':'#9dbdd1','Хаки':'#7b8060','Тёмно-серый':'#595c58','Пыльно-бирюзовый':'#739a93','Серый':'#93958f','Ярко-синий':'#275cc0','Красный':'#b94337','Бежевый':'#c4b293','Зеленое яблоко':'#9baf4b','Фиолетовый':'#765483','Светло-серый':'#c0c3bc','Зелёный':'#456750','Красная':'#b94337'};
let artwork = null;
let state = {product:0, color:1, quantity:1000, sizeQuantities:{}, format:rates[0].format, inks:1, effect:1};
const sizeSelections = new Map();
const offers = {
  price:['Футболки с нанесением', 'от 464,40 ₽'],
  batch:['Мерч от 50 изделий.', 'Стоимость — сразу.'],
  deadline:['Мерч к вашему событию.', 'Изготовление от 5 дней.'],
  team:['Одежда для команды', 'с вашим логотипом.'],
  quality:['13 моделей одежды.', 'Нанесение под вашу задачу.']
};
const offer = new URLSearchParams(location.search).get('offer');
function setupOffer() {
  const selected = Object.hasOwn(offers, offer) ? offer : 'price';
  const title = document.getElementById('hero-title');
  const [lead, promise] = offers[selected];
  const example = quote({product:0,color:1,quantity:1000,format:rates[0].format,inks:1,effect:1});
  const emphasis = document.createElement('em');
  const exampleUnit = document.querySelector('.hero-example-unit');
  const examplePrice = exampleUnit.querySelector('strong');
  examplePrice.removeAttribute('id');
  exampleUnit.hidden = selected === 'price';
  if (selected === 'price') {
    const price = document.createElement('span');
    price.id = 'hero-price';
    price.textContent = money(example.unit);
    emphasis.append(document.createTextNode('от '), price);
  } else {
    emphasis.textContent = promise;
    examplePrice.id = 'hero-price';
    examplePrice.textContent = money(example.unit);
  }
  title.replaceChildren(document.createTextNode(lead), document.createElement('br'), emphasis);
  $('hero-total').textContent = money(example.total);
  document.title = title.textContent + ' — PNHD';
}
$('model').innerHTML = products.map((p,i)=>`<option value="${i}">${p.name}</option>`).join('');
$('format').innerHTML = [...new Set(rates.map(r=>r.format))].map(f=>`<option>${f}</option>`).join('');
function sizeCapacity() {
  const p = products[state.product];
  return p.sizes.reduce((sum,size)=>sum+p.stock[size],0);
}
function sizeError(s = state) {
  if (!s.sizeQuantities) return '';
  const p = products[s.product];
  let total = 0;
  for (const size of p.sizes) {
    const n = Number(s.sizeQuantities[size] ?? 0);
    if (!Number.isSafeInteger(n) || n < 0) return `Размер ${size}: введите целое количество от 0 до ${p.stock[size]}.`;
    if (n > p.stock[size]) return `Размер ${size}: доступно ${p.stock[size]} шт., выбрано ${n}. Уменьшите количество.`;
    total += n;
  }
  if (total !== Number(s.quantity)) return `Общий тираж должен совпадать с суммой размеров. Доступно всего ${sizeCapacity()} шт.`;
  return '';
}
function quote(s) {
  const q = Number(s.quantity);
  if (!Number.isSafeInteger(q) || q < 50 || q > 1000000 || sizeError(s)) return null;
  const p = products[s.product];
  const g = p.prices[q<100?0:q<200?1:2];
  const r = rates.find(r=>r.format===s.format && r.colors===s.inks);
  if (!r) return null;
  const index = q<100?0:q<300?1:q<500?2:q<700?3:q<1000?4:5;
  const print = Math.round(r.rates[index]*(p.colors[s.color]==='Белый'?1:1.3)*s.effect*100)/100;
  return {garments:Math.round(g*q*100)/100, printing:Math.round(print*q*100)/100, unit:Math.round((g+print)*100)/100, total:Math.round((g+print)*q*100)/100};
}
function renderSizes() {
  const p = products[state.product];
  $('size-grid').innerHTML = p.sizes.map((size,i)=>`<div class="size-cell"><label for="size-${i}">${size}</label><input id="size-${i}" data-size="${size}" aria-label="Количество размера ${size}" aria-describedby="size-stock-${i} quantity-error" type="number" min="0" max="${p.stock[size]}" step="1" inputmode="numeric" value="${state.sizeQuantities[size] ?? 0}"><small id="size-stock-${i}">В наличии: ${p.stock[size]}</small></div>`).join('');
  $('quantity').max = sizeCapacity();
  $('size-stock-note').textContent = `Демонстрационные остатки: по 100 шт. на размер. Всего для модели: ${sizeCapacity()} шт. Наличие подтвердим перед заказом.`;
}
function distributeTotal(value) {
  state.quantity = Number(value);
  const p = products[state.product];
  if (Number.isSafeInteger(state.quantity) && state.quantity>=0 && state.quantity<=sizeCapacity()) {
    const counts = Object.fromEntries(p.sizes.map(size=>[size,0]));
    let remaining = state.quantity;
    while (remaining>0) for (const size of p.sizes) {
      if (remaining && counts[size]<p.stock[size]) {counts[size]++;remaining--;}
    }
    state.sizeQuantities = counts;
    renderSizes();
  }
  $('quantity').value = value;
  update();
}
function inks() {
  const max = state.format.startsWith('Ручник')?2:8;
  state.inks = Math.min(state.inks,max);
  $('ink').innerHTML = Array.from({length:max},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');
  $('ink').value = state.inks;
}
function colors() {
  const p = products[state.product];
  $('swatches').innerHTML = p.colors.map((c,i)=>`<button title="${c}" aria-label="${c}" aria-pressed="${i===state.color}" class="${i===state.color?'active':''}" style="background:${palette[c]||'#bbb'}" data-color="${i}"></button>`).join('');
  $('color-name').textContent = p.colors[state.color];
  $('selected-name').textContent = p.name;
  $('product-counter').textContent = String(state.product+1).padStart(2,'0')+' / 13';
  document.querySelectorAll('.product-card').forEach((el,i)=>el.classList.toggle('chosen',i===state.product));
}
function update() {
  const q = quote(state);
  const error = sizeError() || (!q?'Минимальный тираж — 50 изделий. Введите целое количество в пределах доступного остатка.':'');
  $('quantity-error').textContent = error || `Всего выбрано: ${state.quantity} шт. Минимальный тираж — 50 изделий.`;
  $('quantity-error').classList.toggle('error',!q);
  $('quantity').setAttribute('aria-invalid',String(!q));
  document.querySelectorAll('[data-size]').forEach(input=> {
    const n = Number(input.value);
    input.setAttribute('aria-invalid',String(!Number.isSafeInteger(n) || n<0 || n>Number(input.max)));
  });
  $('garments').textContent = q?money(q.garments):'—';
  $('printing').textContent = q?money(q.printing):'—';
  $('total').textContent = q?money(q.total):'—';
  $('per-unit').textContent = q?money(q.unit)+' / шт. по тарифам':'';
  $('review').disabled = !q;
  $('plus').disabled = Number(state.quantity)>=sizeCapacity();
  $('minus').disabled = Number(state.quantity)<=50;
  document.querySelectorAll('.presets button').forEach(b=> {
    b.classList.toggle('active',Number(b.textContent)===Number(state.quantity));
    b.disabled = Number(b.textContent)>sizeCapacity();
  });
  sizeSelections.set(state.product,{quantity:state.quantity,counts:{...state.sizeQuantities}});
  try {sessionStorage.setItem('pnhd-configuration',JSON.stringify(state));} catch {}
}
$('products').innerHTML = products.map((p,i)=>`<button class="product-card ${i===0?'chosen':''}" data-product="${i}" data-type="${p.name.startsWith('Футболка')?'tee':'hood'}"><div class="card-photo"><small>${String(i+1).padStart(2,'0')} / PNHD</small>+<span class="arrow">↗</span></div><h3>${p.name}</h3><p>${p.colors.length} цвет. · от 50 шт.</p><div class="card-colors">${p.colors.map(c=>`<i style="background:${palette[c]||'#bbb'}"></i>`).join('')}</div></button>`).join('');
function selectModel(i) {
  state.product = Number(i);
  state.color = 0;
  const saved = sizeSelections.get(state.product);
  state.sizeQuantities = saved?{...saved.counts}:Object.fromEntries(products[state.product].sizes.map(size=>[size,0]));
  state.quantity = saved?saved.quantity:0;
  $('quantity').value = state.quantity;
  $('model').value = i;
  renderSizes();colors();update();
}
$('model').onchange = e=>selectModel(e.target.value);
$('swatches').onclick = e=> {
  const b=e.target.closest('[data-color]');
  if(b) {state.color=Number(b.dataset.color);colors();update();}
};
$('quantity').oninput = e=>distributeTotal(e.target.value);
$('minus').onclick = ()=>distributeTotal(Math.max(50,Number(state.quantity)-50));
$('plus').onclick = ()=>distributeTotal(Math.min(sizeCapacity(),Number(state.quantity)+50));
$('size-clear').onclick = ()=>distributeTotal(0);
$('size-grid').oninput = e=> {
  if(!e.target.matches('[data-size]')) return;
  state.sizeQuantities[e.target.dataset.size] = e.target.value;
  state.quantity = products[state.product].sizes.reduce((sum,size)=>sum+Number(state.sizeQuantities[size]||0),0);
  $('quantity').value = Number.isFinite(state.quantity)?state.quantity:'';
  update();
};
document.querySelector('.presets').onclick = e=> {
  if(e.target.tagName==='BUTTON' && !e.target.disabled) distributeTotal(Number(e.target.textContent));
};
$('format').onchange = e=> {state.format=e.target.value;inks();update();window.refreshArtworkQuote?.();};
$('ink').onchange = e=> {state.inks=Number(e.target.value);update();};
$('effect').onchange = e=> {state.effect=Number(e.target.value);update();};
$('products').onclick = e=> {
  const b=e.target.closest('[data-product]');
  if(b) {selectModel(b.dataset.product);$('calculator').scrollIntoView();$('model').focus({preventScroll:true});}
};
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=> {
  document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));
  document.querySelectorAll('.product-card').forEach(x=>x.hidden=b.dataset.filter!=='all' && x.dataset.type!==b.dataset.filter);
});
const dialog=$('order-dialog');
let orderType='standard';
function summary() {
  const p=products[state.product],q=quote(state);
  const sizes=p.sizes.filter(size=>Number(state.sizeQuantities[size])>0).map(size=>`${size}: ${state.sizeQuantities[size]} шт.`).join(', ');
  return `${p.name} · ${p.colors[state.color]} · ${state.quantity} шт.\nРазмеры: ${sizes||'не выбраны'}.\nШелкография: ${state.format}, цветов: ${state.inks}.\n${artwork?`Макет: ${artwork.name}. Оценка цветов: ${artwork.count>8?'более 8':artwork.count||'не определена'}${artwork.ignoreWhite?' (без белого фона)':''}. Файл нужно передать отдельно.\n`:''}По известным тарифам предварительно: ${q?money(q.total):'нужен расчёт'}. Полная стоимость не определена.`;
}
function openOrder(type) {orderType=type;$('order-summary').textContent=summary();$('saved-message').textContent='';dialog.showModal();}
$('review').onclick=()=> {if(quote(state)) openOrder('standard');};
$('custom').onclick=()=>openOrder('custom');
document.querySelector('.close').onclick=()=>dialog.close();
dialog.addEventListener('click',e=> {
  if(e.target===dialog) {const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}
});
$('download').onclick=()=> {
  const text='PNHD — конфигурация для согласования\nТип: '+(orderType==='custom'?'Нестандартный запрос':'Стандартный тираж')+'\n'+summary()+'\nЖелаемая дата: '+($('date').value||'не указана')+'\nКомментарий: '+$('comment').value+'\nПодготовка, тип ткани, налоги, упаковка, доставка и наличие требуют подтверждения. Заявка не отправлена.';
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='PNHD-configuration.txt';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('saved-message').textContent='Конфигурация сохранена. Заявка не отправлена.';
};
setupOffer();inks();colors();distributeTotal(1000);
