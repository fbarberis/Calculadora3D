document.addEventListener('DOMContentLoaded', () => {
    const themeSwitcher = document.getElementById('theme-switcher');
    themeSwitcher.addEventListener('change', () => {
        document.body.classList.toggle('light-mode');
        document.body.classList.toggle('dark-mode');
        const label = document.querySelector('label[for="theme-switcher"]');
        if (document.body.classList.contains('light-mode')) {
            label.textContent = 'Modo Oscuro';
        } else {
            label.textContent = 'Modo Claro';
        }
    });

    const quantityToggle = document.getElementById('quantity-toggle');
    const quantityInputGroup = document.getElementById('quantity-input-group');
    quantityToggle.addEventListener('change', () => {
        if (quantityToggle.checked) {
            quantityInputGroup.style.display = 'block';
        } else {
            quantityInputGroup.style.display = 'none';
        }
    });
});

function calculateCosts() {
    const materialCost = parseFloat(document.getElementById('material-cost').value);
    const materialWeight = parseFloat(document.getElementById('material-weight').value);
    const printHours = parseFloat(document.getElementById('print-hours').value);
    const printMinutes = parseFloat(document.getElementById('print-minutes').value);
    const printerWattage = parseFloat(document.getElementById('printer-wattage').value);
    const electricityCost = parseFloat(document.getElementById('electricity-cost').value);
    const consumablesCost = parseFloat(document.getElementById('consumables-cost').value);
    const errorMargin = parseFloat(document.getElementById('error-margin').value);
    const profitMargin = parseFloat(document.getElementById('profit-margin').value);
    const quantityToggle = document.getElementById('quantity-toggle').checked;
    const pieceQuantity = quantityToggle ? parseInt(document.getElementById('piece-quantity').value) : 1;

    const printTime = printHours + (printMinutes / 60);

    const materialPrice = (materialCost / 1000) * materialWeight;
    const electricityPrice = ((printerWattage / 1000) * printTime) * electricityCost;
    
    const subtotal = materialPrice + electricityPrice + consumablesCost;
    const errorMarginPrice = subtotal * (errorMargin / 100);
    const totalCost = subtotal + errorMarginPrice;
    const totalToCharge = totalCost * (1 + profitMargin / 100);

    const resultsDiv = document.getElementById('results');
    let resultsHTML = `
        <h4>Resultados del Cálculo de Costos</h4>
        <ul class="list-group">
            <li class="list-group-item d-flex justify-content-between align-items-center">
                Precio Material
                <span>ARS$ ${materialPrice.toFixed(2)}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center">
                Precio Luz
                <span>ARS$ ${electricityPrice.toFixed(2)}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center">
                Costo de Insumos
                <span>ARS$ ${consumablesCost.toFixed(2)}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center">
                Margen de Error
                <span>ARS$ ${errorMarginPrice.toFixed(2)}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <strong>Costo Total</strong>
                <span><strong>ARS$ ${totalCost.toFixed(2)}</strong></span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <strong>TOTAL A COBRAR</strong>
                <span><strong>ARS$ ${totalToCharge.toFixed(2)}</strong></span>
            </li>`;

    if (quantityToggle && pieceQuantity > 0) {
        const costPerPiece = totalCost / pieceQuantity;
        const pricePerPiece = totalToCharge / pieceQuantity;
        resultsHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <strong>Costo por Pieza</strong>
                <span><strong>ARS$ ${costPerPiece.toFixed(2)}</strong></span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <strong>Precio por Pieza</strong>
                <span><strong>ARS$ ${pricePerPiece.toFixed(2)}</strong></span>
            </li>`;
    }

    resultsHTML += '</ul>';
    resultsDiv.innerHTML = resultsHTML;
}