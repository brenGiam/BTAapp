import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Configuración de Supabase
const SUPABASE_URL = "https://eybbkskvmowofxqswwua.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5YmJrc2t2bW93b2Z4cXN3d3VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg3NjkxNzgsImV4cCI6MjA1NDM0NTE3OH0.xycoA06H6evTgqsMq_Uqd3SLv4E_2WwbNn9TxFHZ8SM";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Referencias a los elementos del HTML
const fechaEl = document.getElementById("fecha");
const horasUsoEl = document.getElementById("horas-uso");
const notasEl = document.getElementById("notas");
const historialEl = document.getElementById("historial");
const agregarBtnEl = document.getElementById("agregar-btn");

// Asegurarse de que el DOM esté completamente cargado antes de ejecutar el código
document.addEventListener("DOMContentLoaded", () => {
    // Registrar el Service Worker para la PWA
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js")
            .then(() => console.log("Service Worker registrado"))
            .catch((error) => console.error("Error al registrar el Service Worker:", error));
    }

    // Solicitar permiso para notificaciones
    async function solicitarPermisoNotificaciones() {
        if ("Notification" in window && "serviceWorker" in navigator) {
            const permiso = await Notification.requestPermission();
            if (permiso === "granted") {
                console.log("Permiso de notificaciones concedido.");
            }
        }
    }
    solicitarPermisoNotificaciones();

    // Función para agregar un nuevo registro de uso
    agregarBtnEl.addEventListener("click", async () => {
        const fecha = fechaEl.value;
        const horasUso = parseInt(horasUsoEl.value);
        const notas = notasEl.value || "";

        if (fecha && !isNaN(horasUso)) {
            // Obtener el último registro para acumular las horas de aceite y horas totales correctamente
            const { data: historialData, error: historialError } = await supabase
                .from('mantenimiento_bta')
                .select("total_horas, horas_aceite")
                .order('fecha', { ascending: false })
                .limit(1);  // Solo necesitamos el último registro para obtener el total actual de horas

            if (historialError) {
                console.error("Error al obtener el historial de horas:", historialError);
            } else {
                let totalHoras = horasUso;  // Inicializamos con las horas de este registro
                let totalAceite = horasUso; // Inicializamos con las horas de aceite del nuevo registro

                if (historialData.length > 0) {
                    const ultimoRegistro = historialData[0];
                    totalHoras += ultimoRegistro.total_horas;
                    totalAceite += ultimoRegistro.horas_aceite;
                }

                // Insertar el nuevo registro con las horas acumuladas
                const { data, error } = await supabase
                    .from('mantenimiento_bta')
                    .insert([{
                        fecha,
                        horas_usadas: horasUso,
                        total_horas: totalHoras,
                        horas_aceite: totalAceite,  // Se acumulan las horas de aceite
                        notas
                    }]);

                if (error) {
                    console.error("Error al insertar los datos:", error);
                } else {
                    fechaEl.value = "";
                    horasUsoEl.value = "";
                    notasEl.value = "";
                    cargarHistorial();  // Recargar el historial después de insertar
                }
            }
        } else {
            alert("Por favor, ingresa una fecha y un número válido de horas.");
        }
    });

    // Función para resetear las horas de aceite
    historialEl.addEventListener("click", async (event) => {
        if (event.target.classList.contains("reset-aceite-btn")) {
            const registroId = event.target.getAttribute("data-id");
            console.log("ID del registro a resetear:", registroId);  // Aquí puedes ver el ID en consola

            const confirmacion = confirm("¿Seguro que quieres resetear las horas de aceite para este registro?");
            if (!confirmacion) return;

            try {
                const { data, error } = await supabase
                    .from("mantenimiento_bta")
                    .update({ horas_aceite: 0 })
                    .eq("id", registroId);  // Verifica que "id" sea el nombre correcto en la base de datos

                console.log("Resultado de la actualización:", data, "Error:", error);  // Agregar para depurar

                if (error) {
                    console.error("Error al resetear horas de aceite:", error);
                    alert("Hubo un problema al resetear las horas de aceite.");
                } else {
                    console.log("Registro actualizado con éxito:", data);
                    alert("¡Horas de aceite reseteadas correctamente!");
                    await cargarHistorial();  // Recargar el historial después de la actualización
                }
            } catch (error) {
                console.error("Error general:", error);
                alert("Ocurrió un error inesperado.");
            }
        }
    });

    // Función para cargar el historial de uso y verificar alertas
    async function cargarHistorial() {
        const { data, error } = await supabase
            .from("mantenimiento_bta")
            .select("*")
            .order("fecha", { ascending: false });

        if (error) {
            console.error("Error al cargar historial:", error);
            return;
        }

        historialEl.innerHTML = "";  // Limpiar historial antes de recargar

        let horasDesdeUltimoCambioAceite = 0;

        data.forEach((registro, index) => {


            const tr = document.createElement("tr");
            tr.innerHTML = `
                   <td>${registro.fecha}</td>
                <td>${registro.horas_usadas}</td>
                <td>${registro.total_horas || "N/A"}</td>
                <td>${registro.horas_aceite}</td>
                <td>${registro.notas}</td>
                <td>
                    <button class="reset-aceite-btn" data-id="${registro.id}">🔄 Reset Aceite</button>
                </td>
            `;
            historialEl.appendChild(tr);

            horasDesdeUltimoCambioAceite = registro.horas_aceite;
        });

        //VER   // Verificar si es necesario un cambio de aceite
        if (horasDesdeUltimoCambioAceite >= 50) {
            enviarNotificacion("Mantenimiento requerido", "¡Es hora de cambiar el aceite!");
        }
    }

    // Función para enviar notificaciones
    function enviarNotificacion(titulo, mensaje) {
        if (Notification.permission === "granted") {
            navigator.serviceWorker.ready.then((sw) => {
                sw.showNotification(titulo, {
                    body: mensaje,
                    icon: "/imagenes/favicon-32x32.png",
                    vibrate: [200, 100, 200]
                });
            });
        }
    }

    // Cargar historial al iniciar la aplicación
    cargarHistorial();
});



