document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENTOS DOM ---
    const loginScreen = document.getElementById('login-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    const loginForm = document.getElementById('login-form');
    
    // Controles Básicos
    const btnLogout = document.getElementById('btn-logout');
    const btnToggleTheme = document.getElementById('btn-toggle-theme');
    const btnConfigLimits = document.getElementById('btn-config-limits');
    const btnExportCsv = document.getElementById('btn-export-csv');
    const btnRefreshLogs = document.getElementById('btn-refresh-logs');
    const themeIcon = document.getElementById('theme-icon');
    const toastContainer = document.getElementById('toast-container');
    const datetimeDisplay = document.getElementById('datetime-display');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const sidebar = document.querySelector('.sidebar');
    
    // Elementos Visuales Datos
    const currentLevelText = document.getElementById('current-level');
    const tankWater = document.getElementById('tank-water');
    const pumpStatusIndicator = document.querySelector('#pump-status .status-indicator');
    const pumpStatusText = document.querySelector('#pump-status span');
    const percentageVal = document.getElementById('percentage-val');
    const volumeProgress = document.getElementById('volume-progress');
    const volumeLiters = document.getElementById('volume-liters');
    const logsTbody = document.getElementById('logs-tbody');
    
    // Bomba Animada
    const pumpGraphic = document.getElementById('pump-graphic');
    const waterDrop = document.getElementById('water-drop');
    
    // Elementos SCADA Control
    const btnModeAuto = document.getElementById('btn-mode-auto');
    const btnModeManual = document.getElementById('btn-mode-manual');
    const modeBadge = document.getElementById('mode-badge');
    const btnPumpOn = document.getElementById('btn-pump-on');
    const btnPumpOff = document.getElementById('btn-pump-off');
    const overflowWarning = document.getElementById('overflow-warning');

    const btnConfigWifi = document.getElementById('btn-config-wifi');
    const btnConfigUnits = document.getElementById('btn-config-units');
    const btnSoporte = document.getElementById('btn-soporte');
    const btnSoporteFloat = document.getElementById('btn-soporte-float');

    let levelChart = null;
    let pollInterval = null;
    let clockInterval = null;

    // Configuración Global SCADA
    const MAX_TANK_LEVEL = 3000;
    const MAX_LITERS = 5000;
    const DANGER_LIMIT = 2950; // mm -> Si sube de esto es desbordamiento
    let currentOperationMode = 'manual';
    let isInDanger = false;
    let lastKnownLevel = 0;
    let currentUnit = localStorage.getItem('unit') || 'mm'; // Unidad activa: mm, cm, m

    // --- CONVERSOR DE UNIDADES ---
    const convertirDesdeM = (mm, unit) => {
        if (unit === 'cm') return +(mm / 10).toFixed(1);
        if (unit === 'm')  return +(mm / 1000).toFixed(3);
        return Math.round(mm); // mm por defecto
    };

    const maxConvertido = (unit) => {
        if (unit === 'cm') return MAX_TANK_LEVEL / 10;
        if (unit === 'm')  return MAX_TANK_LEVEL / 1000;
        return MAX_TANK_LEVEL;
    };

    // --- UTILIDADES ---
    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = message;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };

    const updateClock = () => {
        const now = new Date();
        datetimeDisplay.innerText = now.toLocaleString();
    };

    const getToken = () => localStorage.getItem('token');
    const setToken = (token) => localStorage.setItem('token', token);
    const removeToken = () => localStorage.removeItem('token');

    const switchScreen = (screen) => {
        if (screen === 'dashboard') {
            loginScreen.classList.add('hidden');
            loginScreen.classList.remove('active');
            dashboardScreen.classList.remove('hidden');
            
            initDashboard();
        } else {
            dashboardScreen.classList.add('hidden');
            loginScreen.classList.remove('hidden');
            loginScreen.classList.add('active');
            stopDashboard();
        }
    };

    // UI Móvil
    mobileMenuBtn?.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
    });

    // --- TEMA CLARO/OSCURO ---
    const currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme === 'light') {
        document.body.classList.add('light-mode');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
    }

    btnToggleTheme.addEventListener('click', (e) => {
        e.preventDefault();
        document.body.classList.toggle('light-mode');
        if (document.body.classList.contains('light-mode')) {
            themeIcon.classList.replace('fa-moon', 'fa-sun');
            localStorage.setItem('theme', 'light');
        } else {
            themeIcon.classList.replace('fa-sun', 'fa-moon');
            localStorage.setItem('theme', 'dark');
        }
    });

    // --- AUTENTICACIÓN ---
    const checkAuth = async () => {
        const token = getToken();
        if (!token) return;

        try {
            const resp = await fetch('/api/auth/renew', {
                headers: { 'x-token': token }
            });
            if (resp.ok) {
                const data = await resp.json();
                setToken(data.token);
                switchScreen('dashboard');
            } else {
                removeToken();
            }
        } catch (error) {
            console.error(error);
        }
    };

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.username.value;
        const password = e.target.password.value;

        try {
            const resp = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await resp.json();

            if (resp.ok) {
                setToken(data.token);
                Swal.fire({
                    title: 'Acceso Autorizado',
                    icon: 'success',
                    background: '#1e293b',
                    color: '#fff',
                    timer: 1500,
                    showConfirmButton: false
                });
                e.target.reset();
                switchScreen('dashboard');
            } else {
                Swal.fire('Denegado', data.msg, 'error');
            }
        } catch (error) {
            Swal.fire('Error', 'Fallo de Red', 'error');
        }
    });

    btnLogout.addEventListener('click', () => {
        Swal.fire({
            title: '¿Cerrar Sesión?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, salir',
            background: '#1e293b', color: '#fff'
        }).then((result) => {
            if (result.isConfirmed) {
                removeToken();
                switchScreen('login');
            }
        });
    });

    // --- CONTROL SCADA LOGICA ---
    const actualizarBotonesDeBombaSegunModo = () => {
        if (currentOperationMode === 'auto') {
            btnPumpOn.disabled = true;
            btnPumpOff.disabled = true;
            modeBadge.className = 'current-mode-badge auto';
            modeBadge.innerText = 'Automático';
            btnModeAuto.classList.add('active');
            btnModeManual.classList.remove('active');
        } else {
            // Evaluamos peligro antes de habilitar ON
            btnPumpOn.disabled = isInDanger;
            btnPumpOff.disabled = false;
            
            modeBadge.className = 'current-mode-badge manual';
            modeBadge.innerText = 'Manual';
            btnModeManual.classList.add('active');
            btnModeAuto.classList.remove('active');
        }
    }

    // Solicita contraseña usando SweetAlert2
    const promptParaCambioDeModo = async (nuevoModo) => {
        if (currentOperationMode === nuevoModo) return;

        const { value: password } = await Swal.fire({
            title: 'Autorización Requerida',
            text: `Ingrese su contraseña para pasar a modo ${nuevoModo.toUpperCase()}`,
            input: 'password',
            inputPlaceholder: 'Contraseña de administrador',
            showCancelButton: true,
            background: '#1e293b', color: '#fff'
        });

        if (password) {
            // Mandar al servidor
            try {
                const resp = await fetch('/api/control/modo', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-token': getToken()
                    },
                    body: JSON.stringify({ password, modo: nuevoModo })
                });

                const data = await resp.json();

                if (resp.ok) {
                    currentOperationMode = nuevoModo;
                    actualizarBotonesDeBombaSegunModo();
                    Swal.fire({
                        title: 'Modo Actualizado',
                        icon: 'success',
                        background: '#1e293b', color: '#fff',
                        timer: 1500, showConfirmButton: false
                    });
                } else {
                    Swal.fire('Error', data.msg, 'error');
                }
            } catch (err) {
                Swal.fire('Error', 'Fallo de Red', 'error');
            }
        }
    }

    btnModeAuto.addEventListener('click', () => promptParaCambioDeModo('auto'));
    btnModeManual.addEventListener('click', () => promptParaCambioDeModo('manual'));

    // Botones Manual de Bomba
    const lanzarComandoBomba = async (comando) => {
        if (currentOperationMode !== 'manual') return;
        
        try {
            const resp = await fetch('/api/control/bomba', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-token': getToken()
                },
                body: JSON.stringify({ estado: comando })
            });

            if (resp.ok) {
                showToast(`Orden ${comando.toUpperCase()} enviada al ESP32`, 'success');
                // Optimizacion UI: Mover el status_indicator a "buscando..." o asumirlo por UX
            } else {
                showToast('Falló al enviar comando a Bomba', 'error');
            }
        } catch (e) {
            showToast('Fallback Servidor inactivo', 'error');
        }
    };

    btnPumpOn.addEventListener('click', () => lanzarComandoBomba('on'));
    btnPumpOff.addEventListener('click', () => lanzarComandoBomba('off'));

    // Configuración de Límites Dinámicos
    btnConfigLimits.addEventListener('click', async (e) => {
        e.preventDefault();
        const { value: formValues } = await Swal.fire({
            title: 'Parámetros Operativos',
            html: `
                <input id="swal-input1" class="swal2-input" placeholder="Límite Bajo (Ej: 500) mm" type="number">
                <input id="swal-input2" class="swal2-input" placeholder="Límite Alto (Ej: 2800) mm" type="number">
                <input id="swal-input3" class="swal2-input" placeholder="Clave Administrador" type="password">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Configurar Firmware',
            background: document.body.classList.contains('light-mode') ? '#fff' : '#1e293b',
            color: document.body.classList.contains('light-mode') ? '#000' : '#fff',
            preConfirm: () => {
                return [
                    document.getElementById('swal-input1').value,
                    document.getElementById('swal-input2').value,
                    document.getElementById('swal-input3').value
                ]
            }
        });

        if (formValues && formValues[0] && formValues[1] && formValues[2]) {
            try {
                const resp = await fetch('/api/control/limites', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-token': getToken() },
                    body: JSON.stringify({ 
                        limiteBajo: formValues[0], 
                        limiteAlto: formValues[1], 
                        password: formValues[2] 
                    })
                });
                const data = await resp.json();
                if (resp.ok) {
                    Swal.fire('Guardado', data.msg, 'success');
                    cargarEventos(); // Refrescar logs
                } else {
                    Swal.fire('Denegado', data.msg, 'error');
                }
            } catch (err) {
                Swal.fire('Error', 'Fallo conectando al servidor', 'error');
            }
        }
    });

    // --- CONFIGURACIÓN WI-FI RESPALDO ---
    btnConfigWifi.addEventListener('click', async (e) => {
        e.preventDefault();
        const { value: formValues } = await Swal.fire({
            title: 'Configurar Wi-Fi de Respaldo',
            html: `
                <div style="margin-bottom: 15px; text-align: left;">
                    <label style="color: #fff; font-size: 14px;">¿Activar conexión Wi-Fi de emergencia?</label>
                    <select id="swal-wifi-enabled" class="swal2-input">
                        <option value="false">NO (Uso exclusivo Celular SIM)</option>
                        <option value="true">SÍ (Usar Wi-Fi si está disponible)</option>
                    </select>
                </div>
                <input id="swal-wifi-ssid" class="swal2-input" placeholder="Nombre de la red Wi-Fi (SSID)" type="text">
                <input id="swal-wifi-pwd" class="swal2-input" placeholder="Contraseña de la red (Dejar vacío si no tiene)" type="password">
                <input id="swal-wifi-admin" class="swal2-input" placeholder="Clave Administrador (Autorización)" type="password">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Configurar Firmware',
            background: document.body.classList.contains('light-mode') ? '#fff' : '#1e293b',
            color: document.body.classList.contains('light-mode') ? '#000' : '#fff',
            preConfirm: () => {
                return [
                    document.getElementById('swal-wifi-enabled').value,
                    document.getElementById('swal-wifi-ssid').value,
                    document.getElementById('swal-wifi-pwd').value,
                    document.getElementById('swal-wifi-admin').value
                ]
            }
        });

        if (formValues && formValues[3]) { // Si la password administrador fue ingresada
            try {
                const isEnabled = formValues[0] === 'true';
                const ssid = formValues[1];
                
                if (isEnabled && !ssid) {
                    return Swal.fire('Error', 'Debe escribir el nombre de la red Wi-Fi si desea activarlo.', 'error');
                }

                const resp = await fetch('/api/control/wifi-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-token': getToken() },
                    body: JSON.stringify({ 
                        enabled: isEnabled,
                        ssid: ssid || 'NONE',
                        wifi_password: formValues[2],
                        password: formValues[3] 
                    })
                });
                const data = await resp.json();
                if (resp.ok) {
                    Swal.fire('¡Conectado Satisfactoriamente!', 'La orden de enlace Wi-Fi ha sido enviada al equipo.', 'success');
                    cargarEventos(); 
                } else {
                    Swal.fire('Denegado', data.msg, 'error');
                }
            } catch (err) {
                Swal.fire('Error', 'Fallo conectando al servidor', 'error');
            }
        }
    });

    // --- SOPORTE ---
    const showSupportModal = (e) => {
        e.preventDefault();
        Swal.fire({
            title: 'Soporte Técnico',
            html: `
                <div style="text-align: center; font-size: 16px;">
                    <p style="font-weight: bold; margin-bottom: 15px; font-size: 18px; color: #3b82f6;">Ingeniero en Automática Industrial</p>
                    <p style="margin-bottom: 8px;"><i class="fa-solid fa-envelope" style="color: #94a3b8;"></i> <a href="mailto:dzemanater@unicauca.edu.co" style="color: inherit; text-decoration: none;">dzemanater@unicauca.edu.co</a></p>
                    <p><i class="fa-solid fa-envelope" style="color: #94a3b8;"></i> <a href="mailto:juanvaldez@unicauca.edu.co" style="color: inherit; text-decoration: none;">juanvaldez@unicauca.edu.co</a></p>
                </div>
            `,
            icon: 'info',
            background: document.body.classList.contains('light-mode') ? '#fff' : '#1e293b',
            color: document.body.classList.contains('light-mode') ? '#000' : '#fff',
            confirmButtonText: 'Cerrar'
        });
    };

    btnSoporte?.addEventListener('click', showSupportModal);
    btnSoporteFloat?.addEventListener('click', showSupportModal);

    // Descargar CSV
    btnExportCsv.addEventListener('click', (e) => {
        e.preventDefault();
        const token = getToken();
        // Agregamos el token a la url temporalmente o usamos fetch (más limpio fetch para blobs)
        fetch('/api/registros/exportar', {
            headers: { 'x-token': token }
        }).then(res => res.blob()).then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'reporte_historico_tanque.csv';
            document.body.appendChild(a);
            a.click();    
            a.remove();
        }).catch(() => showToast('Error al descargar CSV', 'error'));
    });

    // Cargar Historial Logs
    const cargarEventos = async () => {
        try {
            const res = await fetch('/api/eventos?limite=10', { headers: { 'x-token': getToken() } });
            if (res.ok) {
                const data = await res.json();
                logsTbody.innerHTML = '';
                data.eventos.forEach(evt => {
                    const dateObj = new Date(evt.fecha);
                    const formatoFecha = dateObj.toLocaleString();
                    const tr = document.createElement('tr');
                    const tdFecha = document.createElement('td'); tdFecha.innerText = formatoFecha;
                    const tdSev = document.createElement('td'); tdSev.innerHTML = `<span class="badge-sev ${evt.severidad}">${evt.severidad}</span>`;
                    const tdMsg = document.createElement('td'); tdMsg.innerText = evt.mensaje;
                    const tdUser = document.createElement('td'); tdUser.innerText = evt.usuarioAsociado ? evt.usuarioAsociado.nombre : 'Sistema IoT';
                    
                    tr.appendChild(tdFecha); tr.appendChild(tdSev); tr.appendChild(tdMsg); tr.appendChild(tdUser);
                    logsTbody.appendChild(tr);
                });
                if(data.eventos.length === 0) logsTbody.innerHTML = '<tr><td colspan="4" class="text-center">Sin eventos registrados</td></tr>';
            }
        } catch (e) {}
    };

    btnRefreshLogs.addEventListener('click', cargarEventos);


    // --- DASHBOARD: LECTURA Y SEGURIDAD ---
    const procesarPeligro = (nivel) => {
        if (nivel >= DANGER_LIMIT) {
            if (!isInDanger) {
                isInDanger = true;
                overflowWarning.classList.remove('hidden');
                
                // Si estamos en manual y la bomba pudiese estar encendida, forzamos apagado automático POR SEGURIDAD.
                if (currentOperationMode === 'manual') {
                    showToast('DESBORDAMIENTO: Sistema apagando bomba automáticamente', 'error');
                    lanzarComandoBomba('off');
                    actualizarBotonesDeBombaSegunModo(); // Esto inhabilitará el ON
                }
            }
        } else {
            if (isInDanger) {
                isInDanger = false;
                overflowWarning.classList.add('hidden');
                actualizarBotonesDeBombaSegunModo(); // Liberar el boton ON si bajó del límite
            }
        }
    }

    const initChart = () => {
        const ctx = document.getElementById('levelChart').getContext('2d');
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = 'Outfit';

        levelChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Nivel del Tanque (mm)',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3b82f6',
                    pointRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: MAX_TANK_LEVEL, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    };

    const updateDashboardData = async () => {
        try {
            // Nivel y Estado
            const resDisp = await fetch('/api/dispositivos?limite=1');
            const dataDisp = await resDisp.json();
            
            let nivelActual = 0;
            let bombaActiva = false; 
            
            if (dataDisp.dispositivos && dataDisp.dispositivos.length > 0) {
                const dispositivo = dataDisp.dispositivos[0]; 
                
                if (dispositivo.valor && typeof dispositivo.valor.valor === 'number') {
                    nivelActual = dispositivo.valor.valor;
                    if (dispositivo.valor.bomba !== undefined) bombaActiva = dispositivo.valor.bomba;
                    
                    if (dispositivo.valor.modo !== undefined) {
                        const m = dispositivo.valor.modo === 'automatico' ? 'auto' : 'manual';
                        if (currentOperationMode !== m) {
                            currentOperationMode = m;
                            actualizarBotonesDeBombaSegunModo();
                        }
                    }
                } else if (typeof dispositivo.valor === 'number') {
                    nivelActual = dispositivo.valor;
                }

            }

            // Actualizar Tarjeta Principal (aplicando la unidad activa)
            lastKnownLevel = nivelActual; // guardar en mm siempre
            currentLevelText.innerText = convertirDesdeM(nivelActual, currentUnit);
            
            // Lógica de Desbordamiento Local
            procesarPeligro(nivelActual);

            // Actualizar Bomba Lectura Visual
            if (bombaActiva) {
                pumpStatusIndicator.classList.remove('offline');
                pumpStatusIndicator.classList.add('online');
                pumpStatusText.innerText = 'Bomba Encendida (ON)';
                pumpGraphic.classList.add('active');
                waterDrop.classList.remove('hidden');
                waterDrop.classList.add('active');
            } else {
                pumpStatusIndicator.classList.remove('online');
                pumpStatusIndicator.classList.add('offline');
                pumpStatusText.innerText = 'Bomba Apagada (OFF)';
                pumpGraphic.classList.remove('active');
                waterDrop.classList.add('hidden');
                waterDrop.classList.remove('active');
            }

            // Actualizar Animación Tanque
            let porcentage = (nivelActual / MAX_TANK_LEVEL) * 100;
            if(porcentage > 100) porcentage = 100;
            if(porcentage < 0) porcentage = 0;
            tankWater.style.height = `${porcentage}%`;

            // Actualizar Métricas de Volumen SCADA
            percentageVal.innerText = Math.round(porcentage);
            volumeProgress.style.width = `${porcentage}%`;
            volumeLiters.innerText = Math.round((porcentage / 100) * MAX_LITERS) + ' L';


            // Historico Grafico
            const resReg = await fetch('/api/registros?limite=15', { headers: { 'x-token': getToken() }});
            if (resReg.ok) {
                const dataReg = await resReg.json();
                const etiquetas = [];
                const datosNivel = [];

                dataReg.registros.forEach(reg => {
                    const date = new Date(reg.fecha);
                    etiquetas.push(`${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`);
                    let val = 0;
                    if (typeof reg.valor === 'number') val = reg.valor;
                    else if (reg.valor && reg.valor.valor) val = reg.valor.valor;
                    datosNivel.push(convertirDesdeM(val, currentUnit)); // convertir a unidad activa
                });

                if (levelChart) {
                    levelChart.data.labels = etiquetas;
                    levelChart.data.datasets[0].data = datosNivel;
                    levelChart.data.datasets[0].label = `Nivel del Tanque (${currentUnit})`;
                    levelChart.options.scales.y.max = maxConvertido(currentUnit);
                    levelChart.update();
                }
            }
        } catch (error) {
            console.error('Data poll error', error);
        }
    };

    const initDashboard = () => {
        updateClock();
        clockInterval = setInterval(updateClock, 60000);
        actualizarBotonesDeBombaSegunModo();
        cargarEventos();
        aplicarUnidades(); // Aplicar unidad guardada al arrancar

        if (!levelChart) initChart();
        updateDashboardData();
        pollInterval = setInterval(updateDashboardData, 3000);
    };

    const stopDashboard = () => {
        if (pollInterval) clearInterval(pollInterval);
        if (clockInterval) clearInterval(clockInterval);
    };

    // --- CONFIGURAR UNIDADES (desde el sidebar) ---

    // Aplica la unidad activa a todos los elementos del dashboard
    const aplicarUnidades = () => {
        const unitLabel  = document.getElementById('unit-label');
        const chartLabel = document.getElementById('chart-unit-label');
        const scaleTop   = document.getElementById('scale-top');
        const scaleMid   = document.getElementById('scale-mid');
        const scaleBot   = document.getElementById('scale-bot');

        if (unitLabel)  unitLabel.innerText  = currentUnit;
        if (chartLabel) chartLabel.innerText = currentUnit;

        // Escala del tanque (MAX_TANK_LEVEL = 3000 mm)
        if (scaleTop) scaleTop.innerText = `${convertirDesdeM(3000, currentUnit)} ${currentUnit}`;
        if (scaleMid) scaleMid.innerText = `${convertirDesdeM(1500, currentUnit)} ${currentUnit}`;
        if (scaleBot) scaleBot.innerText = `0 ${currentUnit}`;

        // Valor actual del sensor
        if (lastKnownLevel !== undefined) {
            currentLevelText.innerText = convertirDesdeM(lastKnownLevel, currentUnit);
        }
    };

    btnConfigUnits?.addEventListener('click', async (e) => {
        e.preventDefault();

        const opcionActual = currentUnit;
        const { value: unitElegida } = await Swal.fire({
            title: 'Configurar Unidades',
            html: `
                <p style="color: var(--text-muted); margin-bottom: 20px; font-size: 14px;">Selecciona la unidad de medida para todos los valores de nivel</p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="opt-mm" onclick="document.getElementById('unit-choice').value='mm'" 
                        style="padding: 14px 24px; border-radius: 12px; border: 2px solid ${
                            opcionActual === 'mm' ? '#3b82f6' : 'rgba(255,255,255,0.15)'
                        }; background: ${
                            opcionActual === 'mm' ? 'rgba(59,130,246,0.2)' : 'transparent'
                        }; color: white; font-size: 20px; font-weight: 800; cursor: pointer; font-family: Outfit; transition: all 0.2s;"
                        onmouseover="this.style.borderColor='#3b82f6'" onmouseout="if(document.getElementById('unit-choice').value!=='mm')this.style.borderColor='rgba(255,255,255,0.15)'">
                        mm
                    </button>
                    <button id="opt-cm" onclick="document.getElementById('unit-choice').value='cm'"
                        style="padding: 14px 24px; border-radius: 12px; border: 2px solid ${
                            opcionActual === 'cm' ? '#3b82f6' : 'rgba(255,255,255,0.15)'
                        }; background: ${
                            opcionActual === 'cm' ? 'rgba(59,130,246,0.2)' : 'transparent'
                        }; color: white; font-size: 20px; font-weight: 800; cursor: pointer; font-family: Outfit; transition: all 0.2s;"
                        onmouseover="this.style.borderColor='#3b82f6'" onmouseout="if(document.getElementById('unit-choice').value!=='cm')this.style.borderColor='rgba(255,255,255,0.15)'">
                        cm
                    </button>
                    <button id="opt-m" onclick="document.getElementById('unit-choice').value='m'"
                        style="padding: 14px 24px; border-radius: 12px; border: 2px solid ${
                            opcionActual === 'm' ? '#3b82f6' : 'rgba(255,255,255,0.15)'
                        }; background: ${
                            opcionActual === 'm' ? 'rgba(59,130,246,0.2)' : 'transparent'
                        }; color: white; font-size: 20px; font-weight: 800; cursor: pointer; font-family: Outfit; transition: all 0.2s;"
                        onmouseover="this.style.borderColor='#3b82f6'" onmouseout="if(document.getElementById('unit-choice').value!=='m')this.style.borderColor='rgba(255,255,255,0.15)'">
                        m
                    </button>
                </div>
                <input type="hidden" id="unit-choice" value="${opcionActual}">
            `,
            background: document.body.classList.contains('light-mode') ? '#fff' : '#1e293b',
            color: document.body.classList.contains('light-mode') ? '#000' : '#fff',
            showCancelButton: true,
            confirmButtonText: 'Aplicar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => document.getElementById('unit-choice').value
        });

        if (unitElegida && unitElegida !== currentUnit) {
            currentUnit = unitElegida;
            localStorage.setItem('unit', currentUnit);
            aplicarUnidades();       // Actualiza labels y escala del tanque
            updateDashboardData();   // Recarga el gráfico con la nueva unidad
            showToast(`Unidades cambiadas a ${currentUnit}`, 'success');
        }
    });

    // --- ARRANQUE ---
    checkAuth();
});
