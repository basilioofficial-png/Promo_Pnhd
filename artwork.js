(() => {
  const input = document.getElementById('artwork-file');
  const status = document.getElementById('artwork-status');
  const preview = document.getElementById('artwork-preview');
  const image = document.getElementById('artwork-image');
  const palette = document.getElementById('artwork-palette');
  const ignoreWhite = document.getElementById('artwork-ignore-white');
  const apply = document.getElementById('artwork-apply');
  let pixels = null;
  let previewUrl = null;
  let revision = 0;

  // Reduce near-identical shades and JPEG/antialiasing noise before counting inks.
  function estimate(data, excludeWhite) {
    const bins = new Map();
    let visible = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (data[i + 3] < 128 || (excludeWhite && r >= 245 && g >= 245 && b >= 245)) continue;
      visible++;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bin = bins.get(key) || {n: 0, r: 0, g: 0, b: 0};
      bin.n++; bin.r += r; bin.g += g; bin.b += b;
      bins.set(key, bin);
    }
    const clusters = [];
    for (const bin of [...bins.values()].sort((a, b) => b.n - a.n)) {
      const color = [bin.r / bin.n, bin.g / bin.n, bin.b / bin.n];
      const near = clusters.find(c => c.rgb.reduce((sum, channel, i) => sum + (channel - color[i]) ** 2, 0) < 64 ** 2);
      if (near) {
        near.rgb = near.rgb.map((channel, i) => (channel * near.n + color[i] * bin.n) / (near.n + bin.n));
        near.n += bin.n;
      } else clusters.push({rgb: color, n: bin.n});
    }
    return clusters.filter(c => c.n >= Math.max(1, visible * 0.003)).sort((a, b) => b.n - a.n);
  }

  function refresh() {
    apply.hidden = !artwork || !artwork.count;
    if (!artwork) return;
    const max = state.format.startsWith('Ручник') ? 2 : 8;
    apply.disabled = artwork.count > max;
    if (!artwork.count) {
      status.textContent = 'Цвета не найдены. Проверьте прозрачность изображения и настройку белого фона; можно задать цвета вручную.';
    } else if (artwork.count > 8) {
      status.textContent = 'Найдено более 8 цветовых групп. Для фотографии или градиента нужна подготовка макета; число красок согласуйте с производством. Расчёт не изменён.';
    } else {
      status.textContent = `Предварительное количество цветов: ${artwork.count}. ` + (artwork.count > max
        ? `Для выбранного формата доступно до ${max} цветов. Выберите другой формат или укажите число красок вручную. Расчёт не изменён.`
        : 'Нажмите «Применить к расчёту» или задайте число красок вручную.');
    }
  }
  window.refreshArtworkQuote = refresh;

  function analyze() {
    if (!pixels || !artwork) return;
    const groups = estimate(pixels, ignoreWhite.checked);
    artwork.count = groups.length;
    artwork.ignoreWhite = ignoreWhite.checked;
    palette.replaceChildren(...groups.slice(0, 16).map(group => {
      const swatch = document.createElement('span');
      const hex = '#' + group.rgb.map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
      swatch.style.backgroundColor = hex;
      swatch.title = hex;
      swatch.setAttribute('aria-label', hex);
      return swatch;
    }));
    refresh();
  }

  function clear(resetInput = true) {
    revision++;
    pixels = null;
    artwork = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    image.removeAttribute('src');
    preview.hidden = true;
    if (resetInput) input.value = '';
    input.removeAttribute('aria-invalid');
    ignoreWhite.checked = false;
    palette.replaceChildren();
    apply.hidden = true;
    status.removeAttribute('aria-busy');
    status.classList.remove('error');
    status.textContent = 'Макет не выбран. Количество цветов также можно указать вручную в параметрах печати.';
  }

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    clear(false);
    const request = revision;
    let bitmap;
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Выберите PNG, JPG или WebP. Для PDF и других форматов укажите число красок вручную.');
      if (file.size > 20 * 1024 * 1024) throw new Error('Файл больше 20 МБ. Уменьшите размер и выберите его снова.');
      status.textContent = 'Анализируем макет…';
      status.setAttribute('aria-busy', 'true');
      bitmap = await createImageBitmap(file);
      if (request !== revision) return;
      if (bitmap.width * bitmap.height > 100000000) throw new Error('Слишком большое разрешение. Уменьшите изображение до 100 мегапикселей.');
      const scale = Math.min(1, 384 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d', {willReadFrequently: true});
      if (!ctx) throw new Error('Браузер не поддерживает анализ изображения. Укажите количество цветов вручную.');
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      artwork = {name: file.name, count: 0, ignoreWhite: false};
      previewUrl = URL.createObjectURL(file);
      image.src = previewUrl;
      document.getElementById('artwork-name').textContent = file.name;
      preview.hidden = false;
      analyze();
    } catch (error) {
      if (request !== revision) return;
      input.setAttribute('aria-invalid', 'true');
      status.classList.add('error');
      status.textContent = error instanceof Error && error.name === 'Error'
        ? error.message : 'Не удалось прочитать изображение. Проверьте файл или выберите другой PNG, JPG или WebP.';
    } finally {
      bitmap?.close();
      if (request === revision) status.removeAttribute('aria-busy');
    }
  });
  ignoreWhite.addEventListener('change', analyze);
  document.getElementById('artwork-remove').addEventListener('click', () => clear());
  apply.addEventListener('click', () => {
    if (!artwork?.count || apply.disabled) return;
    state.inks = artwork.count;
    inks();
    update();
    document.querySelector('.print-settings').open = true;
    status.textContent = `В расчёте установлено цветов: ${state.inks}. Окончательное число красок подтвердит производство.`;
    document.getElementById('ink').focus({preventScroll: true});
  });
})();
