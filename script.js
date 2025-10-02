// ===== Utilidades =====
const $ = (sel, ctx = document) => ctx.querySelector(sel);

// ===== Data do evento (sábado) – America/Sao_Paulo (UTC-03) =====
const eventDateISO = '2025-10-04T10:00:00-03:00';
const eventEndISO = '2025-10-04T15:00:00-03:00';
const eventDate = new Date(eventDateISO);

// ===== Countdown =====
function pad(n) { return String(n).padStart(2, '0') }
function tick() {
    const now = new Date();
    let diff = eventDate - now; if (diff < 0) diff = 0;
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    $('#dd').textContent = pad(d);
    $('#hh').textContent = pad(h);
    $('#mm').textContent = pad(m);
    $('#ss').textContent = pad(s);
}
tick(); setInterval(tick, 1000);

// ===== Estoque/escassez local (somente visual; controle real deve ser backend) =====
const TOTAL = 30;
const used = Number(localStorage.getItem('gf_reserved') || 0);
let reservas = Math.min(used, TOTAL);
function renderStock() {
    const left = Math.max(TOTAL - reservas, 0);
    $('#left').textContent = left;
    $('#leftInline').textContent = left;
    $('#reservados').textContent = `${reservas} reservados`;
    const pct = Math.max(0, Math.min(100, (reservas / TOTAL) * 100));
    $('#fill').style.width = pct + '%';
}
renderStock();

// ===== Captura de UTM =====
const params = new URLSearchParams(location.search);
['utm_source', 'utm_medium', 'utm_campaign'].forEach(k => {
    const v = params.get(k) || '';
    const el = $('#' + k); if (el) el.value = v;
});

// ===== Máscara simples para WhatsApp (BR) =====
const wInput = $('#whatsapp');
wInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    const p = [];
    if (v.length > 0) { p.push('(' + v.slice(0, 2) + ')'); }
    if (v.length >= 3) { p.push(' ' + v.slice(2, 3)); }
    if (v.length >= 7) { p.push(' ' + v.slice(3, 7) + '-' + v.slice(7)); }
    else if (v.length > 3) { p.push(' ' + v.slice(3)); }
    e.target.value = p.join('');
});

// ===== Validação =====
function setErr(name, msg) { const el = document.querySelector(`[data-err="${name}"]`); if (el) el.textContent = msg || ''; }
function validate() {
    let ok = true;
    const nome = $('#nome').value.trim();
    const email = $('#email').value.trim();
    const whatsapp = $('#whatsapp').value.replace(/\D/g, '');
    setErr('nome', ''); setErr('email', ''); setErr('whatsapp', '');
    if (nome.length < 3) { setErr('nome', 'Informe seu nome completo.'); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr('email', 'E-mail inválido.'); ok = false; }
    if (whatsapp.length < 10) { setErr('whatsapp', 'Informe um WhatsApp válido.'); ok = false; }
    if (!document.getElementById('consent').checked) { ok = false; document.getElementById('formMsg').innerHTML = '<span class="error">Você precisa aceitar o consentimento.</span>'; }
    return ok;
}

// ===== Envio =====
const form = document.getElementById('leadForm');
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('formMsg').textContent = '';
    if (document.getElementById('company').value) { return; } // honeypot
    if (!validate()) return;
    const btn = document.getElementById('submitBtn'); btn.disabled = true; btn.textContent = 'Enviando...';

    const data = Object.fromEntries(new FormData(form));
    data.event = 'Golden Fest 2 anos – Casa Verde';
    data.event_date = eventDateISO;
    data.pickup_window = '04/10/2025 10:00–15:00';
    data.rules = 'Retirada mediante documento do titular da inscrição';

    try {
        // TODO: troque a URL abaixo pelo seu webhook (n8n/Zapier/Apps Script/Supabase REST etc.)
        const ENDPOINT = 'https://webhook.franciscojlalves.com.br/webhook/lead-intake';
        const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!res.ok) throw new Error('Falha no envio');

        reservas = Math.min(reservas + 1, TOTAL);
        localStorage.setItem('gf_reserved', String(reservas));
        renderStock();

        form.reset();
        document.getElementById('formMsg').innerHTML = '<span class="success">Prontinho! Recebemos seus dados. Enviaremos a confirmação por WhatsApp em instantes.</span>';
    } catch (err) {
        console.error(err);
        document.getElementById('formMsg').innerHTML = '<span class="error">Ops! Não foi possível enviar agora. Tente novamente em alguns segundos.</span>';
    } finally {
        btn.disabled = false; btn.textContent = 'Quero meu óculos';
    }
});

// ===== Backend – contador de inscritos =====
const BACKEND_URL = "https://webhook.franciscojlalves.com.br/webhook/get_leads";
const POLL_INTERVAL_MS = 30000; // 30s
const FETCH_TIMEOUT_MS = 9000; // timeout de rede

function extrairArray(data) {
  // Se vier string JSON, parseia
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {}
  }
  // Se já for array
  if (Array.isArray(data)) return data;

  // Se for objeto, tenta padrões comuns
  if (data && typeof data === "object") {
    // Formato comum do n8n: { rows: [...] } ou { rows: [{ json: {...} }, ...] }
    if (Array.isArray(data.rows)) {
      const rows = data.rows;
      if (
        rows.length &&
        rows[0] &&
        typeof rows[0] === "object" &&
        "json" in rows[0]
      ) {
        return rows.map((r) => r.json);
      }
      return rows;
    }
    // Outros nomes frequentes
    for (const k of ["count"]) {
      if (typeof data[k] === "number") return { __count__: data[k] };
    }
    for (const k of ["data", "items", "result", "values", "records", "body"]) {
      if (Array.isArray(data[k])) return data[k];
    }
  }
  return [];
}

async function getInscritosCount(signal) {
  const res = await fetch(BACKEND_URL, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const payload = await res.json();

  // Se o backend já devolver { count: N }
  if (payload && typeof payload.count === "number") {
    return payload.count;
  }

  // Senão, extraímos o array e contamos
  const arr = extrairArray(payload);
  // Caso extrairArray tenha devolvido { __count__: N }
  if (arr && typeof arr.__count__ === "number") return arr.__count__;
  return Array.isArray(arr) ? arr.length : 0;
}

async function initBackendStock() {
  try {
    // timeout manual para não deixar fetch pendurado
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort("timeout"), FETCH_TIMEOUT_MS);
    const backendCount = await getInscritosCount(controller.signal);
    clearTimeout(to);

    // Não permitir que o número "caia" se o usuário acabou de ver um valor maior localmente
    const novo = Math.min(backendCount, TOTAL);
    reservas = Math.max(reservas, novo);
    renderStock();
    // console.debug('[escassez] backend:', backendCount, 'reservas:', reservas);
  } catch (err) {
    console.warn("[escassez] falha ao consultar backend:", err);
    // Fallback: mantém o valor local (localStorage) e não quebra nada
  }
}

// Inicializa ao carregar (se seu <script> está no fim do <body>, pode chamar direto)
initBackendStock();
// Mantém sincronizado
setInterval(initBackendStock, POLL_INTERVAL_MS);

// Ano no footer

document.getElementById('year').textContent = new Date().getFullYear();
