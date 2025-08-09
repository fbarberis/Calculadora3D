(function() {
    'use strict';

    // Estado de la aplicación
    const state = {
        savedCalculations: JSON.parse(localStorage.getItem('savedCalculations') || '[]')
    };

    // Procesar archivo G-code
    async function processGcodeFile(file) {
        return new Promise((resolve, reject) => {
            console.log('Iniciando procesamiento del archivo:', file.name);
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    console.log('Archivo leído, procesando contenido...');
                    const content = e.target.result;
                    
                    // Debug: Mostrar las líneas relevantes
                    console.log('Buscando líneas relevantes:');
                    content.split('\n').forEach((line, index) => {
                        if (line.includes('source_info') || 
                            line.includes('used_filament') || 
                            line.includes('print_time') ||
                            line.includes('model_instances') ||
                            line.includes('estimated printing time')) {
                            console.log(`Línea ${index + 1}:`, line.trim());
                        }
                    });
                    
                    const gcodeInfo = parseGcode(content);
                    console.log('Información extraída:', gcodeInfo);
                    
                    populateFormFromGcode(gcodeInfo);
                    showNotification('Información del archivo G-code cargada correctamente', 'success');
                    resolve();
                } catch (error) {
                    console.error('Error en el procesamiento:', error);
                    showNotification(`Error al procesar el archivo: ${error.message}`, 'danger');
                    reject(error);
                }
            };
            
            reader.onerror = (error) => {
                console.error('Error leyendo el archivo:', error);
                showNotification('Error al leer el archivo', 'danger');
                reject(error);
            };
            
            reader.readAsText(file);
        });
    }

    // Analizar contenido del G-code
    function parseGcode(content) {
        const info = {
            fileName: '',
            printTime: 0,
            filamentWeight: 0,
            pieceCount: 1
        };

        console.log('Analizando contenido del archivo G-code...');
        
        try {
            // Buscar información en todo el contenido
            const lines = content.split('\n');
            
            // Buscar el tiempo de impresión
            for (const line of lines) {
                if (line.includes('estimated printing time')) {
                    const timeMatch = line.match(/estimated printing time.*?=\s*(\d+)h\s*(\d+)m\s*(\d+)s/);
                    if (timeMatch) {
                        const hours = parseInt(timeMatch[1]);
                        const minutes = parseInt(timeMatch[2]);
                        const seconds = parseInt(timeMatch[3]);
                        info.printTime = hours * 3600 + minutes * 60 + seconds;
                        console.log('Tiempo encontrado:', hours, 'horas', minutes, 'minutos', seconds, 'segundos');
                        break;
                    }
                }
            }

            // Buscar el nombre y cantidad de piezas
            const sourceInfoLine = lines.find(line => line.includes('source_info'));
            if (sourceInfoLine) {
                try {
                    const sourceInfo = JSON.parse(sourceInfoLine.split('source_info:')[1]);
                    if (sourceInfo.models && sourceInfo.models.length > 0) {
                        info.fileName = sourceInfo.models[0].name.replace(/_id_\d+_copy_\d+$/, '');
                        info.pieceCount = sourceInfo.models.length;
                        console.log('Nombre encontrado:', info.fileName);
                        console.log('Cantidad de piezas:', info.pieceCount);
                    }
                } catch (e) {
                    console.error('Error parseando source_info:', e);
                }
            }

            // Buscar peso del filamento
            const filamentLine = lines.find(line => line.includes('filament used [g]'));
            if (filamentLine) {
                // Extraer los valores separados por coma
                const values = filamentLine.split('=')[1].split(',').map(v => parseFloat(v.trim()));
                // Sumar todos los valores no nulos
                info.filamentWeight = values.reduce((sum, val) => sum + (isNaN(val) ? 0 : val), 0);
                console.log('Peso encontrado:', info.filamentWeight, 'g');
            }

            if (info.printTime === 0 && info.filamentWeight === 0) {
                throw new Error('No se encontró información de tiempo o filamento en el archivo');
            }

        } catch (error) {
            console.error('Error procesando el archivo:', error);
            throw error;
        }

        return info;
    }

    function calculate() {
        const pauloContainer = document.getElementById('paulo-container');
        pauloContainer.classList.add('show');

        setTimeout(() => {
            pauloContainer.classList.remove('show');
        }, 1000);

        const timeMatch = document.getElementById('print-time').value.match(/(\d{2}):(\d{2}):(\d{2})/);
        if (!timeMatch) {
            showNotification('El formato del tiempo debe ser HH:MM:SS', 'danger');
            return;
        }

        const hours = parseInt(timeMatch[1]) + parseInt(timeMatch[2])/60 + parseInt(timeMatch[3])/3600;
        const materialWeight = parseFloat(document.getElementById('material-weight').value);
        
        if (!materialWeight) {
            showNotification('El peso del material es requerido', 'danger');
            return;
        }

        const materialCostPerKg = parseFloat(document.getElementById('material-cost').value);
        const printerWattage = parseFloat(document.getElementById('printer-wattage').value) || 120;
        const electricityRate = parseFloat(document.getElementById('electricity-cost').value) || 450;
        const errorMargin = parseFloat(document.getElementById('error-margin').value) || 10;
        const profitMargin = parseFloat(document.getElementById('profit-margin').value) || 400;
        const pieceQuantity = parseInt(document.getElementById('piece-quantity').value) || 1;
        const shippingCost = parseFloat(document.getElementById('shipping-cost').value) || 0;
        const includeMercadoLibre = document.getElementById('ml-toggle').checked;
        const mlCommission = parseFloat(document.getElementById('ml-commission').value) || 13;

        // El peso y tiempo del G-code ya es el total de la impresión
        const hoursDecimal = parseInt(timeMatch[1]) + parseInt(timeMatch[2])/60 + parseInt(timeMatch[3])/3600;
        
        // 1. Costo total del material para toda la impresión
        const totalMaterialCost = (materialWeight / 1000) * materialCostPerKg;
        // Costo del material por pieza
        const materialCostPerPiece = totalMaterialCost / pieceQuantity;
        
        // 2. Costo total de electricidad para toda la impresión
        // Convertir watts a kilowatts y multiplicar por el costo por kWh
        const totalElectricityCost = (hoursDecimal * (printerWattage / 1000) * electricityRate);
        // Costo de electricidad por pieza
        const electricityCostPerPiece = totalElectricityCost / pieceQuantity;
        
        // 3. Calcular costo total por fallas
        const totalFailureCost = (totalMaterialCost + totalElectricityCost) * (errorMargin / 100);
        // Costo de fallas por pieza
        const failureCostPerPiece = totalFailureCost / pieceQuantity;

        // 4. Calcular costo total por pieza y total general
        const baseCostPerPiece = materialCostPerPiece + electricityCostPerPiece + failureCostPerPiece;
        const totalCost = totalMaterialCost + totalElectricityCost + totalFailureCost;
        // Calcular costo por pieza
        const costPerPiece = totalCost / pieceQuantity;

        // 5. Calcular precio base a cobrar (aplicar margen de ganancia al costo total)
        let totalToCharge = totalCost * (1 + (profitMargin / 100));

        // 7. Agregar costos de envío si existen
        if (shippingCost > 0) {
            totalToCharge += shippingCost;
        }

        // 8. Agregar comisión de MercadoLibre si está activado
        if (includeMercadoLibre) {
            const mercadoLibreComision = totalToCharge * (mlCommission / 100);
            totalToCharge += mercadoLibreComision;
        }

        // 9. Redondear al múltiplo de 10 más cercano menos 1
        totalToCharge = Math.ceil(totalToCharge / 10) * 10 - 1;

        const calculationData = {
            name: document.getElementById('budget-name').value || 'Sin nombre',
            date: new Date().toLocaleDateString(),
            materialCost: totalMaterialCost,
            electricityCost: totalElectricityCost,
            failureCost: totalFailureCost,
            costPerPiece,
            totalCost,
            totalToCharge,
            pieceQuantity,
            profitMargin,
            mercadolibre: includeMercadoLibre
        };

        document.getElementById('results').innerHTML = `
            <div class="alert alert-success mt-3">
                <h4>Resultados del cálculo:</h4>
                <h5>Costos por pieza:</h5>
                <p>Material: ARS$ ${materialCostPerPiece.toFixed(2)}</p>
                <p>Electricidad: ARS$ ${electricityCostPerPiece.toFixed(2)}</p>
                <p>Fallas: ARS$ ${failureCostPerPiece.toFixed(2)}</p>
                <p>Costo total por pieza: ARS$ ${baseCostPerPiece.toFixed(2)}</p>
                
                <h5 class="mt-3">Costos totales para ${pieceQuantity} ${pieceQuantity > 1 ? 'piezas' : 'pieza'}:</h5>
                <p>Material total: ARS$ ${totalMaterialCost.toFixed(2)}</p>
                <p>Electricidad total: ARS$ ${totalElectricityCost.toFixed(2)}</p>
                <p>Fallas total: ARS$ ${totalFailureCost.toFixed(2)}</p>
                <p>Costo total: ARS$ ${totalCost.toFixed(2)}</p>
                
                <h5 class="mt-3">Precio final:</h5>
                <p>Precio a cobrar por ${pieceQuantity} ${pieceQuantity > 1 ? 'piezas' : 'pieza'}: <strong>ARS$ ${totalToCharge.toFixed(2)}</strong></p>
                <p>Precio por pieza: <strong>ARS$ ${(totalToCharge / pieceQuantity).toFixed(2)}</strong></p>
                ${includeMercadoLibre ? `<p class="text-info">Incluye comisión de MercadoLibre (${mlCommission}%)</p>` : ''}
            </div>
        `;

        state.savedCalculations.push(calculationData);
        localStorage.setItem('savedCalculations', JSON.stringify(state.savedCalculations));
        displaySavedCalculations();
    }

    function loadPreset(material) {
        const materialPresets = {
            pla: {
                name: 'PLA',
                cost: 19000,
                printerWattage: 120,
                errorMargin: 10
            },
            petg: {
                name: 'PETG',
                cost: 22000,
                printerWattage: 150,
                errorMargin: 15
            },
            abs: {
                name: 'ABS',
                cost: 20000,
                printerWattage: 180,
                errorMargin: 20
            }
        };

        const preset = materialPresets[material];
        if (preset) {
            document.getElementById('material-cost').value = preset.cost;
            document.getElementById('printer-wattage').value = preset.printerWattage;
            document.getElementById('error-margin').value = preset.errorMargin;
            showNotification(`Preset de ${preset.name} cargado`, 'success');
        }
    }

    // Función para mostrar los cálculos guardados
    function displaySavedCalculations() {
        const calculationsList = document.getElementById('calculations-list');
        if (!calculationsList) return;

        let html = '<div class="list-group">';
        state.savedCalculations.slice().reverse().forEach((calc) => {
            const pieceQuantity = calc.pieceQuantity || 1;
            const totalPerPiece = calc.totalToCharge / pieceQuantity;
            html += `
                <div class="list-group-item">
                    <div class="d-flex w-100 justify-content-between">
                        <h5 class="mb-1">${calc.name}</h5>
                        <small>${calc.date}</small>
                    </div>
                    <div class="d-flex w-100 justify-content-between align-items-center">
                        <div>
                            <p class="mb-1">Total General: ARS$ ${calc.totalToCharge ? calc.totalToCharge.toFixed(2) : '0.00'}</p>
                            <p class="mb-1">Total por Pieza: ARS$ ${!isNaN(totalPerPiece) ? totalPerPiece.toFixed(2) : '0.00'}</p>
                            ${calc.totalCost ? `<small>Costo Total: ARS$ ${calc.totalCost.toFixed(2)}</small>` : ''}
                        </div>
                        <div class="text-right">
                            <small class="d-block">Cantidad: ${pieceQuantity}</small>
                            <small class="d-block">Margen: ${calc.profitMargin}%</small>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        calculationsList.innerHTML = html;
    }

    // Función para mostrar notificaciones
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.zIndex = '9999';
        notification.innerHTML = `
            ${message}
            <button type="button" class="close" data-dismiss="alert">
                <span>&times;</span>
            </button>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    function populateFormFromGcode(info) {
        // Formatear tiempo en HH:MM:SS
        const hours = Math.floor(info.printTime / 3600);
        const minutes = Math.floor((info.printTime % 3600) / 60);
        const seconds = info.printTime % 60;
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Actualizar campos
        document.getElementById('print-time').value = timeStr;
        
        if (info.filamentWeight > 0) {
            document.getElementById('material-weight').value = info.filamentWeight.toFixed(2);
        }

        if (info.fileName) {
            document.getElementById('budget-name').value = info.fileName;
        }

        if (info.pieceCount > 1) {
            const quantityToggle = document.getElementById('quantity-toggle');
            const quantityInputGroup = document.getElementById('quantity-input-group');
            if (quantityToggle && quantityInputGroup) {
                quantityToggle.checked = true;
                quantityInputGroup.style.display = 'block';
                document.getElementById('piece-quantity').value = info.pieceCount;
            }
        }
    }

    // Configurar la aplicación cuando el DOM esté listo
    document.addEventListener('DOMContentLoaded', () => {
        // Inicializar tooltips correctamente usando jQuery
        $(function () {
            $('[data-toggle="tooltip"]').tooltip();
        });

        // Mostrar cálculos guardados
        displaySavedCalculations();

        // Configurar el switch de tema
        const themeSwitcher = document.getElementById('theme-switcher');
        if (themeSwitcher) {
            themeSwitcher.addEventListener('change', () => {
                document.body.classList.toggle('light-mode');
                document.body.classList.toggle('dark-mode');
                const label = document.querySelector('label[for="theme-switcher"]');
                label.textContent = document.body.classList.contains('light-mode') ? 'Modo Oscuro' : 'Modo Claro';
            });
        }

        // Configurar el toggle de cantidad
        const quantityToggle = document.getElementById('quantity-toggle');
        const quantityInputGroup = document.getElementById('quantity-input-group');
        if (quantityToggle && quantityInputGroup) {
            quantityToggle.addEventListener('change', () => {
                quantityInputGroup.style.display = quantityToggle.checked ? 'block' : 'none';
            });
        }

        // Configurar el toggle de MercadoLibre
        const mlToggle = document.getElementById('ml-toggle');
        const mlOptions = document.getElementById('ml-options');
        if (mlToggle && mlOptions) {
            mlToggle.addEventListener('change', () => {
                mlOptions.style.display = mlToggle.checked ? 'block' : 'none';
            });
        }

        // Configurar el drag and drop
        const dropZone = document.getElementById('gcode-drop-zone');
        const fileInput = document.getElementById('gcode-input');
        const dropContent = document.getElementById('drop-content');
        const loadingIndicator = document.getElementById('loading-indicator');

        function showLoading() {
            console.log('Mostrando indicador de carga');
            dropContent.style.display = 'none';
            loadingIndicator.style.display = 'block';
        }

        function hideLoading() {
            console.log('Ocultando indicador de carga');
            loadingIndicator.style.display = 'none';
            dropContent.style.display = 'block';
        }

        if (dropZone && fileInput) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                document.body.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });

            dropZone.addEventListener('dragenter', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('drag-active');
            });

            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('drag-active');
            });

            dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const rect = dropZone.getBoundingClientRect();
                const x = e.clientX;
                const y = e.clientY;
                
                if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
                    dropZone.classList.remove('drag-active');
                }
            });

            dropZone.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-active');

                console.log('Archivo soltado');
                const file = e.dataTransfer.files[0];
                if (file) {
                    console.log('Procesando archivo:', file.name);
                    if (!file.name.toLowerCase().endsWith('.gcode')) {
                        showNotification('Error: El archivo debe ser un G-code (.gcode)', 'danger');
                        return;
                    }
                    showLoading();
                    try {
                        await processGcodeFile(file);
                    } catch (error) {
                        console.error('Error procesando archivo:', error);
                        showNotification('Error procesando el archivo: ' + error.message, 'danger');
                    } finally {
                        hideLoading();
                    }
                }
            });

            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    console.log('Archivo seleccionado:', file.name);
                    if (!file.name.toLowerCase().endsWith('.gcode')) {
                        showNotification('Error: El archivo debe ser un G-code (.gcode)', 'danger');
                        return;
                    }
                    showLoading();
                    try {
                        await processGcodeFile(file);
                    } catch (error) {
                        console.error('Error procesando archivo:', error);
                        showNotification('Error procesando el archivo: ' + error.message, 'danger');
                    } finally {
                        hideLoading();
                    }
                }
            });
        }
    });

    // Exponer funciones necesarias globalmente
    window.calculate = calculate;
    window.loadPreset = loadPreset;
})();
