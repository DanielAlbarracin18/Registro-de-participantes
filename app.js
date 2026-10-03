// ============================================================
// app.js — Frontend independiente para index.html
// No esta acoplado al Worker: solo le habla por HTTP a la URL
// publica de la API (API_BASE). Si algun dia cambias de Worker,
// solo tienes que cambiar esa constante.
// ============================================================

const API_BASE = "https://api-worker.daniel-albarracin300.workers.dev";

// ------------------------------------------------------------
// Helpers genericos
// ------------------------------------------------------------

async function apiQuery(sql, params = []) {
  const res = await fetch(`${API_BASE}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("Respuesta invalida de la API");
  }
  if (!res.ok) throw new Error(data.error || "Error en la consulta");
  return data;
}

function el(id) {
  return document.getElementById(id);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showMsg(id, text, isError = false) {
  const box = el(id);
  if (!box) return;
  box.textContent = text;
  box.classList.remove("hidden", "msg-ok", "msg-error");
  box.classList.add(isError ? "msg-error" : "msg-ok");
  setTimeout(() => box.classList.add("hidden"), 4000);
}

function toggleEmpty(listLength, emptyId) {
  const empty = el(emptyId);
  if (empty) empty.style.display = listLength > 0 ? "none" : "block";
}

// ------------------------------------------------------------
// Estado en memoria (cache de catalogos para llenar selects)
// ------------------------------------------------------------

const state = {
  denominaciones: [],
  iglesias: [],
  instituciones: [],
  grados: [],
  universidades: [],
  carreras: [],
  semestres: [],
  clubes: [],
  equipos: [],
  participantes: [],
};

// ------------------------------------------------------------
// Tabs
// ------------------------------------------------------------

function initTabs() {
  const btns = document.querySelectorAll(".tab-btn");
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      btns.forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      el(`panel-${btn.dataset.tab}`).classList.add("active");
    });
  });
}

// ------------------------------------------------------------
// DENOMINACIONES
// ------------------------------------------------------------

async function loadDenominaciones() {
  const { results } = await apiQuery("SELECT * FROM denominaciones ORDER BY nombre");
  state.denominaciones = results;
  renderDenominaciones();
  fillSelect("iglesiasDenom", state.denominaciones, "-- Selecciona denominacion --");
  fillSelectIfTipo("denominacion");
}

function renderDenominaciones() {
  const ul = el("denomList");
  ul.innerHTML = state.denominaciones
    .map(
      (d) => `<li><span>${escapeHtml(d.nombre)}</span>
        <button class="btn-danger btn-sm" onclick="deleteDenominacion(${d.id})">Eliminar</button></li>`
    )
    .join("");
  toggleEmpty(state.denominaciones.length, "denomEmpty");
}

async function addDenominacion() {
  const nombre = el("denomNombre").value.trim();
  if (!nombre) return showMsg("denomMsg", "Escribe un nombre", true);
  try {
    await apiQuery("INSERT INTO denominaciones (nombre) VALUES (?)", [nombre]);
    el("denomNombre").value = "";
    showMsg("denomMsg", "Denominacion agregada");
    await loadDenominaciones();
  } catch (e) {
    showMsg("denomMsg", e.message, true);
  }
}

async function deleteDenominacion(id) {
  if (!confirm("¿Eliminar esta denominacion? Se eliminaran tambien sus iglesias.")) return;
  try {
    await apiQuery("DELETE FROM denominaciones WHERE id = ?", [id]);
    await Promise.all([loadDenominaciones(), loadIglesias(), loadEquipos()]);
  } catch (e) {
    alert(e.message);
  }
}

// ------------------------------------------------------------
// IGLESIAS
// ------------------------------------------------------------

async function loadIglesias() {
  const { results } = await apiQuery(
    `SELECT i.*, d.nombre AS denom_nombre
     FROM iglesias i JOIN denominaciones d ON d.id = i.denominacion_id
     ORDER BY d.nombre, i.nombre`
  );
  state.iglesias = results;
  renderIglesias();
  fillSelect(
    "partIglesia",
    state.iglesias.map((i) => ({ id: i.id, nombre: `${i.denom_nombre} — ${i.nombre}` })),
    "-- Sin iglesia --"
  );
}

function renderIglesias() {
  const cont = el("iglesiasListContainer");
  const grouped = {};
  state.iglesias.forEach((i) => {
    grouped[i.denom_nombre] = grouped[i.denom_nombre] || [];
    grouped[i.denom_nombre].push(i);
  });
  cont.innerHTML = Object.entries(grouped)
    .map(
      ([denom, items]) => `
      <div class="subblock">
        <h3>${escapeHtml(denom)}</h3>
        <ul class="plain">
          ${items
            .map(
              (i) => `<li><span>${escapeHtml(i.nombre)}${
                i.direccion ? ` — <small>${escapeHtml(i.direccion)}</small>` : ""
              }</span>
              <button class="btn-danger btn-sm" onclick="deleteIglesia(${i.id})">Eliminar</button></li>`
            )
            .join("")}
        </ul>
      </div>`
    )
    .join("");
  toggleEmpty(state.iglesias.length, "iglesiaEmpty");
}

async function addIglesia() {
  const denominacion_id = el("iglesiasDenom").value;
  const nombre = el("iglesiaNombre").value.trim();
  const direccion = el("iglesiaDir").value.trim();
  if (!denominacion_id) return showMsg("iglesiaMsg", "Selecciona una denominacion", true);
  if (!nombre) return showMsg("iglesiaMsg", "Escribe un nombre", true);
  try {
    await apiQuery("INSERT INTO iglesias (denominacion_id, nombre, direccion) VALUES (?, ?, ?)", [
      denominacion_id,
      nombre,
      direccion || null,
    ]);
    el("iglesiaNombre").value = "";
    el("iglesiaDir").value = "";
    showMsg("iglesiaMsg", "Iglesia agregada");
    await loadIglesias();
  } catch (e) {
    showMsg("iglesiaMsg", e.message, true);
  }
}

async function deleteIglesia(id) {
  if (!confirm("¿Eliminar esta iglesia?")) return;
  try {
    await apiQuery("DELETE FROM iglesias WHERE id = ?", [id]);
    await loadIglesias();
  } catch (e) {
    alert(e.message);
  }
}

// ------------------------------------------------------------
// INSTITUCIONES
// ------------------------------------------------------------

async function loadInstituciones() {
  const { results } = await apiQuery("SELECT * FROM instituciones ORDER BY nombre");
  state.instituciones = results;
  renderInstituciones();
  fillSelect("gradosInst", state.instituciones, "-- Selecciona institucion --");
  fillSelectIfTipo("institucion");
}

function renderInstituciones() {
  const ul = el("instList");
  ul.innerHTML = state.instituciones
    .map(
      (i) => `<li><span>${escapeHtml(i.nombre)}</span>
        <button class="btn-danger btn-sm" onclick="deleteInstitucion(${i.id})">Eliminar</button></li>`
    )
    .join("");
  toggleEmpty(state.instituciones.length, "instEmpty");
}

async function addInstitucion() {
  const nombre = el("instNombre").value.trim();
  if (!nombre) return showMsg("instMsg", "Escribe un nombre", true);
  try {
    await apiQuery("INSERT INTO instituciones (nombre) VALUES (?)", [nombre]);
    el("instNombre").value = "";
    showMsg("instMsg", "Institucion agregada");
    await loadInstituciones();
  } catch (e) {
    showMsg("instMsg", e.message, true);
  }
}

async function deleteInstitucion(id) {
  if (!confirm("¿Eliminar esta institucion? Se eliminaran sus grados.")) return;
  try {
    await apiQuery("DELETE FROM instituciones WHERE id = ?", [id]);
    await Promise.all([loadInstituciones(), loadGrados(), loadEquipos()]);
  } catch (e) {
    alert(e.message);
  }
}

// ------------------------------------------------------------
// GRADOS (1-11 por institucion)
// ------------------------------------------------------------

async function loadGrados() {
  const { results } = await apiQuery(
    `SELECT g.*, i.nombre AS inst_nombre
     FROM grados g JOIN instituciones i ON i.id = g.institucion_id
     ORDER BY i.nombre, g.numero`
  );
  state.grados = results;
  renderGrados();
  fillSelect(
    "partGrado",
    state.grados.map((g) => ({ id: g.id, nombre: `${g.inst_nombre} — ${g.numero}°` })),
    "-- Sin grado --"
  );
}

function renderGrados() {
  const cont = el("gradosList");
  const grouped = {};
  state.grados.forEach((g) => {
    grouped[g.inst_nombre] = grouped[g.inst_nombre] || [];
    grouped[g.inst_nombre].push(g);
  });
  cont.innerHTML = Object.entries(grouped)
    .map(
      ([inst, items]) => `
      <div class="subblock">
        <h3>${escapeHtml(inst)}</h3>
        <ul class="plain">
          ${items
            .map(
              (g) => `<li><span class="badge badge-green">${g.numero}°</span>
              <button class="btn-danger btn-sm" onclick="deleteGrado(${g.id})">Eliminar</button></li>`
            )
            .join("")}
        </ul>
      </div>`
    )
    .join("");
  toggleEmpty(state.grados.length, "gradosEmpty");
}

async function addGrados() {
  const institucion_id = el("gradosInst").value;
  if (!institucion_id) return showMsg("gradosMsg", "Selecciona una institucion", true);
  const checks = Array.from(document.querySelectorAll(".grado-check:checked")).map((c) => Number(c.value));
  if (checks.length === 0) return showMsg("gradosMsg", "Selecciona al menos un grado", true);

  const existentes = state.grados
    .filter((g) => String(g.institucion_id) === String(institucion_id))
    .map((g) => g.numero);
  const nuevos = checks.filter((n) => !existentes.includes(n));

  try {
    for (const numero of nuevos) {
      await apiQuery("INSERT INTO grados (institucion_id, numero) VALUES (?, ?)", [institucion_id, numero]);
    }
    document.querySelectorAll(".grado-check:checked").forEach((c) => (c.checked = false));
    showMsg("gradosMsg", `Se asignaron ${nuevos.length} grado(s)`);
    await loadGrados();
  } catch (e) {
    showMsg("gradosMsg", e.message, true);
  }
}

async function deleteGrado(id) {
  if (!confirm("¿Eliminar este grado?")) return;
  try {
    await apiQuery("DELETE FROM grados WHERE id = ?", [id]);
    await loadGrados();
  } catch (e) {
    alert(e.message);
  }
}

// ------------------------------------------------------------
// UNIVERSIDADES
// ------------------------------------------------------------

async function loadUniversidades() {
  const { results } = await apiQuery("SELECT * FROM universidades ORDER BY nombre");
  state.universidades = results;
  renderUniversidades();
  fillSelect("carrerasUniv", state.universidades, "-- Selecciona universidad --");
  fillSelectIfTipo("universidad");
}

function renderUniversidades() {
  const ul = el("univList");
  ul.innerHTML = state.universidades
    .map(
      (u) => `<li><span>${escapeHtml(u.nombre)}</span>
        <button class="btn-danger btn-sm" onclick="deleteUniversidad(${u.id})">Eliminar</button></li>`
    )
    .join("");
  toggleEmpty(state.universidades.length, "univEmpty");
}

async function addUniversidad() {
  const nombre = el("univNombre").value.trim();
  if (!nombre) return showMsg("univMsg", "Escribe un nombre", true);
  try {
    await apiQuery("INSERT INTO universidades (nombre) VALUES (?)", [nombre]);
    el("univNombre").value = "";
    showMsg("univMsg", "Universidad agregada");
    await loadUniversidades();
  } catch (e) {
    showMsg("univMsg", e.message, true);
  }
}

async function deleteUniversidad(id) {
  if (!confirm("¿Eliminar esta universidad? Se eliminaran sus carreras.")) return;
  try {
    await apiQuery("DELETE FROM universidades WHERE id = ?", [id]);
    await Promise.all([loadUniversidades(), loadCarreras(), loadEquipos()]);
  } catch (e) {
    alert(e.message);
  }
}

// ------------------------------------------------------------
// CARRERAS
// ------------------------------------------------------------

async function loadCarreras() {
  const { results } = await apiQuery(
    `SELECT c.*, u.nombre AS univ_nombre
     FROM carreras c JOIN universidades u ON u.id = c.universidad_id
     ORDER BY u.nombre, c.nombre`
  );
  state.carreras = results;
  renderCarreras();
  fillSelect(
    "semestresCarrera",
    state.carreras.map((c) => ({ id: c.id, nombre: `${c.univ_nombre} — ${c.nombre}` })),
    "-- Selecciona carrera --"
  );
}

function renderCarreras() {
  const cont = el("carrerasListContainer");
  const grouped = {};
  state.carreras.forEach((c) => {
    grouped[c.univ_nombre] = grouped[c.univ_nombre] || [];
    grouped[c.univ_nombre].push(c);
  });
  cont.innerHTML = Object.entries(grouped)
    .map(
      ([univ, items]) => `
      <div class="subblock">
        <h3>${escapeHtml(univ)}</h3>
        <ul class="plain">
          ${items
            .map(
              (c) => `<li><span>${escapeHtml(c.nombre)}</span>
              <button class="btn-danger btn-sm" onclick="deleteCarrera(${c.id})">Eliminar</button></li>`
            )
            .join("")}
        </ul>
      </div>`
    )
    .join("");
  toggleEmpty(state.carreras.length, "carreraEmpty");
}

async function addCarrera() {
  const universidad_id = el("carrerasUniv").value;
  const nombre = el("carreraNombre").value.trim();
  if (!universidad_id) return showMsg("carreraMsg", "Selecciona una universidad", true);
  if (!nombre) return showMsg("carreraMsg", "Escribe un nombre", true);
  try {
    await apiQuery("INSERT INTO carreras (universidad_id, nombre) VALUES (?, ?)", [universidad_id, nombre]);
    el("carreraNombre").value = "";
    showMsg("carreraMsg", "Carrera agregada");
    await loadCarreras();
  } catch (e) {
    showMsg("carreraMsg", e.message, true);
  }
}

async function deleteCarrera(id) {
  if (!confirm("¿Eliminar esta carrera? Se eliminaran sus semestres.")) return;
  try {
    await apiQuery("DELETE FROM carreras WHERE id = ?", [id]);
    await Promise.all([loadCarreras(), loadSemestres()]);
  } catch (e) {
    alert(e.message);
  }
}

// ------------------------------------------------------------
// SEMESTRES (1-10 por carrera)
// ------------------------------------------------------------

async function loadSemestres() {
  const { results } = await apiQuery(
    `SELECT s.*, c.nombre AS carrera_nombre, u.nombre AS univ_nombre
     FROM semestres s
     JOIN carreras c ON c.id = s.carrera_id
     JOIN universidades u ON u.id = c.universidad_id
     ORDER BY u.nombre, c.nombre, s.numero`
  );
  state.semestres = results;
  renderSemestres();
  fillSelect(
    "partSemestre",
    state.semestres.map((s) => ({
      id: s.id,
      nombre: `${s.univ_nombre} / ${s.carrera_nombre} — ${s.numero}°`,
    })),
    "-- Sin semestre --"
  );
}

function renderSemestres() {
  const cont = el("semestresList");
  const grouped = {};
  state.semestres.forEach((s) => {
    const key = `${s.univ_nombre} / ${s.carrera_nombre}`;
    grouped[key] = grouped[key] || [];
    grouped[key].push(s);
  });
  cont.innerHTML = Object.entries(grouped)
    .map(
      ([carrera, items]) => `
      <div class="subblock">
        <h3>${escapeHtml(carrera)}</h3>
        <ul class="plain">
          ${items
            .map(
              (s) => `<li><span class="badge badge-orange">${s.numero}°</span>
              <button class="btn-danger btn-sm" onclick="deleteSemestre(${s.id})">Eliminar</button></li>`
            )
            .join("")}
        </ul>
      </div>`
    )
    .join("");
  toggleEmpty(state.semestres.length, "semestresEmpty");
}

async function addSemestres() {
  const carrera_id = el("semestresCarrera").value;
  if (!carrera_id) return showMsg("semestresMsg", "Selecciona una carrera", true);
  const checks = Array.from(document.querySelectorAll(".semestre-check:checked")).map((c) => Number(c.value));
  if (checks.length === 0) return showMsg("semestresMsg", "Selecciona al menos un semestre", true);

  const existentes = state.semestres
    .filter((s) => String(s.carrera_id) === String(carrera_id))
    .map((s) => s.numero);
  const nuevos = checks.filter((n) => !existentes.includes(n));

  try {
    for (const numero of nuevos) {
      await apiQuery("INSERT INTO semestres (carrera_id, numero) VALUES (?, ?)", [carrera_id, numero]);
    }
    document.querySelectorAll(".semestre-check:checked").forEach((c) => (c.checked = false));
    showMsg("semestresMsg", `Se asignaron ${nuevos.length} semestre(s)`);
    await loadSemestres();
  } catch (e) {
    showMsg("semestresMsg", e.message, true);
  }
}

async function deleteSemestre(id) {
  if (!confirm("¿Eliminar este semestre?")) return;
  try {
    await apiQuery("DELETE FROM semestres WHERE id = ?", [id]);
    await loadSemestres();
  } catch (e) {
    alert(e.message);
  }
}

// ------------------------------------------------------------
// CLUBES
// ------------------------------------------------------------

async function loadClubes() {
  const { results } = await apiQuery("SELECT * FROM clubes ORDER BY nombre");
  state.clubes = results;
  renderClubes();
  fillSelect("partClub", state.clubes, "-- Sin club --");
  fillSelectIfTipo("club");
}

function renderClubes() {
  const ul = el("clubList");
  ul.innerHTML = state.clubes
    .map(
      (c) => `<li><span>${escapeHtml(c.nombre)}</span>
        <button class="btn-danger btn-sm" onclick="deleteClub(${c.id})">Eliminar</button></li>`
    )
    .join("");
  toggleEmpty(state.clubes.length, "clubEmpty");
}

async function addClub() {
  const nombre = el("clubNombre").value.trim();
  if (!nombre) return showMsg("clubMsg", "Escribe un nombre", true);
  try {
    await apiQuery("INSERT INTO clubes (nombre) VALUES (?)", [nombre]);
    el("clubNombre").value = "";
    showMsg("clubMsg", "Club agregado");
    await loadClubes();
  } catch (e) {
    showMsg("clubMsg", e.message, true);
  }
}

async function deleteClub(id) {
  if (!confirm("¿Eliminar este club?")) return;
  try {
    await apiQuery("DELETE FROM clubes WHERE id = ?", [id]);
    await Promise.all([loadClubes(), loadEquipos()]);
  } catch (e) {
    alert(e.message);
  }
}

// ------------------------------------------------------------
// EQUIPOS
// ------------------------------------------------------------

function fillSelectIfTipo(tipo) {
  const checked = document.querySelector('input[name="equipo-tipo"]:checked');
  if (checked && checked.value === tipo) updateEquipoEntidadSelect();
}

function updateEquipoEntidadSelect() {
  const tipo = document.querySelector('input[name="equipo-tipo"]:checked').value;
  const map = {
    denominacion: state.denominaciones,
    institucion: state.instituciones,
    universidad: state.universidades,
    club: state.clubes,
  };
  fillSelect("equipoEntidad", map[tipo], "-- Selecciona --");
}

async function loadEquipos() {
  const { results } = await apiQuery(
    `SELECT e.*, d.nombre AS denom_nombre, i.nombre AS inst_nombre,
            u.nombre AS univ_nombre, c.nombre AS club_nombre
     FROM equipos e
     LEFT JOIN denominaciones d ON d.id = e.denominacion_id
     LEFT JOIN instituciones i ON i.id = e.institucion_id
     LEFT JOIN universidades u ON u.id = e.universidad_id
     LEFT JOIN clubes c ON c.id = e.club_id
     ORDER BY e.nombre`
  );
  state.equipos = results;
  renderEquipos();
  renderEquiposParticipanteCheckboxes();
}

function equipoCategoriaInfo(e) {
  if (e.denom_nombre) return { tipo: "Denominación", entidad: e.denom_nombre };
  if (e.inst_nombre) return { tipo: "Institución", entidad: e.inst_nombre };
  if (e.univ_nombre) return { tipo: "Universidad", entidad: e.univ_nombre };
  if (e.club_nombre) return { tipo: "Club", entidad: e.club_nombre };
  return { tipo: "—", entidad: "—" };
}

function renderEquipos() {
  const cont = el("equiposList");
  cont.innerHTML = `
    <ul class="plain">
      ${state.equipos
        .map((e) => {
          const { tipo, entidad } = equipoCategoriaInfo(e);
          return `<li><span><span class="badge badge-green">${tipo}</span>
            ${escapeHtml(entidad)} — <strong>${escapeHtml(e.nombre)}</strong></span>
            <button class="btn-danger btn-sm" onclick="deleteEquipo(${e.id})">Eliminar</button></li>`;
        })
        .join("")}
    </ul>`;
  toggleEmpty(state.equipos.length, "equiposEmpty");
}

function renderEquiposParticipanteCheckboxes() {
  const cont = el("equiposParticipanteCheckbox");
  cont.innerHTML = state.equipos
    .map((e) => {
      const { tipo, entidad } = equipoCategoriaInfo(e);
      return `<label style="display:flex; align-items:center; gap:6px; margin:0; padding:6px; border:1px solid var(--border); border-radius:8px;">
        <input type="checkbox" class="equipo-part-check" value="${e.id}">
        <span style="font-size:12px;">${escapeHtml(tipo)}: ${escapeHtml(entidad)} — ${escapeHtml(e.nombre)}</span>
      </label>`;
    })
    .join("");
}

async function addEquipo() {
  const tipo = document.querySelector('input[name="equipo-tipo"]:checked').value;
  const entidad_id = el("equipoEntidad").value;
  const nombre = el("equipoNombre").value.trim();
  if (!entidad_id) return showMsg("equipoMsg", "Selecciona la entidad", true);
  if (!nombre) return showMsg("equipoMsg", "Escribe un nombre de equipo", true);

  const cols = { denominacion_id: null, institucion_id: null, universidad_id: null, club_id: null };
  cols[`${tipo}_id`] = entidad_id;

  try {
    await apiQuery(
      `INSERT INTO equipos (nombre, denominacion_id, institucion_id, universidad_id, club_id)
       VALUES (?, ?, ?, ?, ?)`,
      [nombre, cols.denominacion_id, cols.institucion_id, cols.universidad_id, cols.club_id]
    );
    el("equipoNombre").value = "";
    showMsg("equipoMsg", "Equipo agregado");
    await loadEquipos();
  } catch (e) {
    showMsg("equipoMsg", e.message, true);
  }
}

async function deleteEquipo(id) {
  if (!confirm("¿Eliminar este equipo?")) return;
  try {
    await apiQuery("DELETE FROM equipos WHERE id = ?", [id]);
    await loadEquipos();
  } catch (e) {
    alert(e.message);
  }
}

function initEquipoTipoRadios() {
  document.querySelectorAll('input[name="equipo-tipo"]').forEach((r) => {
    r.addEventListener("change", updateEquipoEntidadSelect);
  });
}

// ------------------------------------------------------------
// GENERACION AUTOMATICA DE CODIGO (misma logica que la version
// anterior de referencia): una "estacion" aleatoria por
// dispositivo/navegador + un contador diario, combinados en un
// numero que se codifica en base36. Esto evita colisiones entre
// varios dispositivos generando codigos al mismo tiempo, sin
// tener que consultar la API antes de cada registro.
// ------------------------------------------------------------

function obtenerEstacionNum() {
  let val = localStorage.getItem("estacionNum_v1");
  if (val === null) {
    val = Math.floor(Math.random() * 1296);
    localStorage.setItem("estacionNum_v1", String(val));
  }
  return Number(val);
}
const ESTACION_NUM = obtenerEstacionNum();
const EPOCA_BASE = new Date(2025, 0, 1).getTime();

function obtenerContadorCodigos() {
  try {
    return JSON.parse(localStorage.getItem("contadorCodigos_v1") || "{}");
  } catch {
    return {};
  }
}
function guardarContadorCodigos(c) {
  localStorage.setItem("contadorCodigos_v1", JSON.stringify(c));
}

function generarCodigoParticipante() {
  const fecha = new Date();
  const claveDia = `${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, "0")}${String(
    fecha.getDate()
  ).padStart(2, "0")}`;
  const contador = obtenerContadorCodigos();
  contador[claveDia] = (contador[claveDia] || 0) + 1;
  guardarContadorCodigos(contador);
  const secuencia = contador[claveDia];
  const dias = Math.floor((fecha.setHours(0, 0, 0, 0) - EPOCA_BASE) / 86400000);
  const valor = dias * 1296 * 10000 + ESTACION_NUM * 10000 + secuencia;
  return "P" + valor.toString(36).toUpperCase();
}

// ------------------------------------------------------------
// PARTICIPANTES
// ------------------------------------------------------------

async function loadParticipantes() {
  const { results } = await apiQuery(`
    SELECT p.*,
      i.nombre AS iglesia_nombre,
      g.numero AS grado_numero, inst.nombre AS institucion_nombre,
      s.numero AS semestre_numero, c.nombre AS carrera_nombre, u.nombre AS universidad_nombre,
      cl.nombre AS club_nombre,
      (SELECT GROUP_CONCAT(eq.nombre, ', ')
         FROM participante_equipos pe JOIN equipos eq ON eq.id = pe.equipo_id
         WHERE pe.participante_codigo = p.codigo) AS equipos_nombres
    FROM participantes p
    LEFT JOIN iglesias i ON i.id = p.iglesia_id
    LEFT JOIN grados g ON g.id = p.grado_id
    LEFT JOIN instituciones inst ON inst.id = g.institucion_id
    LEFT JOIN semestres s ON s.id = p.semestre_id
    LEFT JOIN carreras c ON c.id = s.carrera_id
    LEFT JOIN universidades u ON u.id = c.universidad_id
    LEFT JOIN clubes cl ON cl.id = p.club_id
    ORDER BY p.nombre
  `);
  state.participantes = results;
  renderParticipantes();
}

function renderParticipantes(filter = "") {
  const term = filter.trim().toLowerCase();
  const rows = state.participantes.filter(
    (p) =>
      !term ||
      p.nombre.toLowerCase().includes(term) ||
      (p.nombre_usuario || "").toLowerCase().includes(term) ||
      p.codigo.toLowerCase().includes(term)
  );

  el("partTableBody").innerHTML = rows
    .map((p) => {
      const gradoSemestre = p.grado_numero
        ? `${escapeHtml(p.institucion_nombre)} — ${p.grado_numero}°`
        : p.semestre_numero
        ? `${escapeHtml(p.universidad_nombre)} / ${escapeHtml(p.carrera_nombre)} — ${p.semestre_numero}°`
        : "—";
      return `<tr>
        <td>${escapeHtml(p.codigo)}</td>
        <td>${escapeHtml(p.nombre)}</td>
        <td>${escapeHtml(p.nombre_usuario || "—")}</td>
        <td>${p.edad ?? "—"}</td>
        <td>${escapeHtml(p.telefono || "—")}<br><small>${escapeHtml(p.correo || "")}</small></td>
        <td>${escapeHtml(p.iglesia_nombre || "—")}</td>
        <td>${gradoSemestre}</td>
        <td>${escapeHtml(p.club_nombre || "—")}</td>
        <td>${escapeHtml(p.equipos_nombres || "—")}</td>
        <td style="white-space:nowrap;">
          <button class="btn-ghost btn-sm" onclick="openEditParticipante('${p.codigo}')">Editar</button>
          <button class="btn-danger btn-sm" onclick="deleteParticipante('${p.codigo}')">Eliminar</button>
        </td>
      </tr>`;
    })
    .join("");
  toggleEmpty(rows.length, "partEmpty");
}

async function addParticipante() {
  const nombre = el("partNombre").value.trim();
  const nombre_usuario = el("partUsuario").value.trim();
  const edad = el("partEdad").value ? Number(el("partEdad").value) : null;
  const telefono = el("partTelefono").value.trim() || null;
  const correo = el("partCorreo").value.trim() || null;
  const iglesia_id = el("partIglesia").value || null;
  const grado_id = el("partGrado").value || null;
  const semestre_id = el("partSemestre").value || null;
  const club_id = el("partClub").value || null;
  const acudiente_nombre = el("acudienteNombre").value.trim() || null;
  const acudiente_telefono = el("acudienteTelefono").value.trim() || null;
  const acudiente_correo = el("acudienteCorreo").value.trim() || null;

  if (!nombre) return showMsg("partMsg", "El nombre es obligatorio", true);
  if (!nombre_usuario) return showMsg("partMsg", "El nombre de usuario es obligatorio", true);

  const equipoIds = Array.from(document.querySelectorAll(".equipo-part-check:checked")).map((c) => c.value);
  const codigo = generarCodigoParticipante();

  try {
    await apiQuery(
      `INSERT INTO participantes
        (codigo, nombre, nombre_usuario, edad, telefono, correo, iglesia_id, grado_id, semestre_id, club_id,
         acudiente_nombre, acudiente_telefono, acudiente_correo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codigo,
        nombre,
        nombre_usuario,
        edad,
        telefono,
        correo,
        iglesia_id,
        grado_id,
        semestre_id,
        club_id,
        acudiente_nombre,
        acudiente_telefono,
        acudiente_correo,
      ]
    );

    // Cuenta bancaria automatica (1 por participante)
    await apiQuery("INSERT INTO cuentas (participante_codigo) VALUES (?)", [codigo]);

    // Asignacion de equipos seleccionados (uno por uno; los triggers validan cada uno)
    const fallos = [];
    for (const equipo_id of equipoIds) {
      try {
        await apiQuery("INSERT INTO participante_equipos (participante_codigo, equipo_id) VALUES (?, ?)", [
          codigo,
          equipo_id,
        ]);
      } catch (err) {
        fallos.push(err.message);
      }
    }

    clearParticipanteForm();
    el("partCodigo").value = codigo;
    showMsg(
      "partMsg",
      fallos.length
        ? `Participante creado con código ${codigo}. Algunos equipos no se pudieron asignar: ${fallos.join(" | ")}`
        : `Participante registrado con código ${codigo}`
    );
    await loadParticipantes();
  } catch (e) {
    showMsg("partMsg", e.message, true);
  }
}

function clearParticipanteForm() {
  [
    "partCodigo",
    "partNombre",
    "partUsuario",
    "partEdad",
    "partTelefono",
    "partCorreo",
    "acudienteNombre",
    "acudienteTelefono",
    "acudienteCorreo",
  ].forEach((id) => (el(id).value = ""));
  ["partIglesia", "partGrado", "partSemestre", "partClub"].forEach((id) => (el(id).value = ""));
  document.querySelectorAll(".equipo-part-check:checked").forEach((c) => (c.checked = false));
}

// ------------------------------------------------------------
// EDITAR PARTICIPANTE
// ------------------------------------------------------------

async function openEditParticipante(codigo) {
  const p = state.participantes.find((x) => x.codigo === codigo);
  if (!p) return;

  // Reusa las opciones ya cargadas en el formulario de registro
  [["editPartIglesia", "partIglesia"], ["editPartGrado", "partGrado"],
   ["editPartSemestre", "partSemestre"], ["editPartClub", "partClub"]].forEach(([dst, src]) => {
    el(dst).innerHTML = el(src).innerHTML;
  });

  el("editPartCodigo").value = p.codigo;
  el("editPartCodigoTxt").textContent = p.codigo;
  el("editPartNombre").value = p.nombre || "";
  el("editPartUsuario").value = p.nombre_usuario || "";
  el("editPartEdad").value = p.edad ?? "";
  el("editPartTelefono").value = p.telefono || "";
  el("editPartCorreo").value = p.correo || "";
  el("editPartIglesia").value = p.iglesia_id ?? "";
  el("editPartGrado").value = p.grado_id ?? "";
  el("editPartSemestre").value = p.semestre_id ?? "";
  el("editPartClub").value = p.club_id ?? "";
  el("editAcudienteNombre").value = p.acudiente_nombre || "";
  el("editAcudienteTelefono").value = p.acudiente_telefono || "";
  el("editAcudienteCorreo").value = p.acudiente_correo || "";

  // Equipos actuales del participante
  const { results } = await apiQuery(
    "SELECT equipo_id FROM participante_equipos WHERE participante_codigo = ?",
    [codigo]
  );
  const actuales = new Set(results.map((r) => String(r.equipo_id)));
  el("editEquiposCheckbox").innerHTML = state.equipos
    .map((e) => {
      const { tipo, entidad } = equipoCategoriaInfo(e);
      return `<label style="display:flex; align-items:center; gap:6px; margin:0; padding:6px; border:1px solid var(--border); border-radius:8px;">
        <input type="checkbox" class="equipo-edit-check" value="${e.id}" ${actuales.has(String(e.id)) ? "checked" : ""}>
        <span style="font-size:12px;">${escapeHtml(tipo)}: ${escapeHtml(entidad)} — ${escapeHtml(e.nombre)}</span>
      </label>`;
    })
    .join("");

  el("editPartModal").classList.remove("hidden");
}

function closeEditParticipante() {
  el("editPartModal").classList.add("hidden");
}

async function saveParticipante() {
  const codigo = el("editPartCodigo").value;
  const nombre = el("editPartNombre").value.trim();
  const nombre_usuario = el("editPartUsuario").value.trim();
  if (!nombre) return showMsg("editPartMsg", "El nombre es obligatorio", true);
  if (!nombre_usuario) return showMsg("editPartMsg", "El nombre de usuario es obligatorio", true);

  try {
    await apiQuery(
      `UPDATE participantes SET
         nombre = ?, nombre_usuario = ?, edad = ?, telefono = ?, correo = ?,
         iglesia_id = ?, grado_id = ?, semestre_id = ?, club_id = ?,
         acudiente_nombre = ?, acudiente_telefono = ?, acudiente_correo = ?
       WHERE codigo = ?`,
      [
        nombre,
        nombre_usuario,
        el("editPartEdad").value ? Number(el("editPartEdad").value) : null,
        el("editPartTelefono").value.trim() || null,
        el("editPartCorreo").value.trim() || null,
        el("editPartIglesia").value || null,
        el("editPartGrado").value || null,
        el("editPartSemestre").value || null,
        el("editPartClub").value || null,
        el("editAcudienteNombre").value.trim() || null,
        el("editAcudienteTelefono").value.trim() || null,
        el("editAcudienteCorreo").value.trim() || null,
        codigo,
      ]
    );

    // Equipos: quitar los desmarcados y agregar los nuevos (los triggers validan cada alta)
    const { results } = await apiQuery(
      "SELECT equipo_id FROM participante_equipos WHERE participante_codigo = ?",
      [codigo]
    );
    const antes = new Set(results.map((r) => String(r.equipo_id)));
    const ahora = new Set(
      Array.from(document.querySelectorAll(".equipo-edit-check:checked")).map((c) => c.value)
    );
    const fallos = [];
    for (const id of antes) {
      if (!ahora.has(id)) {
        await apiQuery("DELETE FROM participante_equipos WHERE participante_codigo = ? AND equipo_id = ?", [codigo, id]);
      }
    }
    for (const id of ahora) {
      if (!antes.has(id)) {
        try {
          await apiQuery("INSERT INTO participante_equipos (participante_codigo, equipo_id) VALUES (?, ?)", [codigo, id]);
        } catch (err) {
          fallos.push(err.message);
        }
      }
    }

    await loadParticipantes();
    if (fallos.length) {
      showMsg("editPartMsg", `Guardado, pero algunos equipos no se pudieron asignar: ${fallos.join(" | ")}`, true);
    } else {
      closeEditParticipante();
      showMsg("partMsg", `Participante ${codigo} actualizado`);
    }
  } catch (e) {
    showMsg("editPartMsg", e.message, true);
  }
}

async function deleteParticipante(codigo) {
  if (!confirm(`¿Eliminar al participante ${codigo}? Se borrara tambien su cuenta e historial.`)) return;
  try {
    await apiQuery("DELETE FROM participantes WHERE codigo = ?", [codigo]);
    await loadParticipantes();
  } catch (e) {
    alert(e.message);
  }
}

function initPartSearch() {
  el("partSearch").addEventListener("input", (ev) => renderParticipantes(ev.target.value));
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeEditParticipante(); });
}

// ------------------------------------------------------------
// EXPORTAR
// ------------------------------------------------------------

const EXPORT_TABLES = [
  "denominaciones",
  "iglesias",
  "instituciones",
  "grados",
  "universidades",
  "carreras",
  "semestres",
  "asignaturas",
  "grado_asignaturas",
  "semestre_asignaturas",
  "clubes",
  "participantes",
  "monedas",
  "cuentas",
  "cuenta_saldos",
  "movimientos",
  "cuestionarios",
  "preguntas",
  "cuestionario_cargas",
  "intentos_cuestionario",
  "respuestas_preguntas",
  "equipos",
  "participante_equipos",
];

async function loadExportStats() {
  const statTables = ["denominaciones", "iglesias", "instituciones", "universidades", "carreras", "clubes", "equipos", "participantes"];
  const counts = await Promise.all(
    statTables.map((t) => apiQuery(`SELECT COUNT(*) AS c FROM ${t}`).then((r) => r.results[0].c))
  );
  el("exportStats").innerHTML = statTables
    .map(
      (t, idx) => `<div class="stat"><div class="num">${counts[idx]}</div><div class="lbl">${t}</div></div>`
    )
    .join("");
}

async function downloadFull() {
  try {
    const data = {};
    for (const table of EXPORT_TABLES) {
      const { results } = await apiQuery(`SELECT * FROM ${table}`);
      data[table] = results;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export_base_datos_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showMsg("exportMsg", "Descarga generada correctamente");
  } catch (e) {
    showMsg("exportMsg", e.message, true);
  }
}

// ------------------------------------------------------------
// Select helper
// ------------------------------------------------------------

function fillSelect(id, items, placeholder) {
  const select = el(id);
  if (!select) return;
  const current = select.value;
  select.innerHTML =
    (placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : "") +
    items.map((it) => `<option value="${it.id}">${escapeHtml(it.nombre)}</option>`).join("");
  if (current && items.some((it) => String(it.id) === current)) select.value = current;
}

// ------------------------------------------------------------
// Carga inicial
// ------------------------------------------------------------

async function loadAll() {
  await loadDenominaciones();
  await loadInstituciones();
  await loadUniversidades();
  await loadClubes();
  await Promise.all([loadIglesias(), loadCarreras()]);
  await Promise.all([loadGrados(), loadSemestres()]);
  await loadEquipos();
  await loadParticipantes();
  await loadExportStats();
  updateEquipoEntidadSelect();
}

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initEquipoTipoRadios();
  initPartSearch();
  loadAll().catch((e) => {
    console.error(e);
    alert("No se pudo conectar con la API. Revisa que la URL en app.js sea correcta y este activa:\n" + API_BASE);
  });
});
