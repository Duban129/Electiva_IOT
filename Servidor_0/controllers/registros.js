const { response } = require('express');
const Registro = require('../models/registro');

const obtenerRegistros = async (req, res = response) => {
    const { limite = 20 } = req.query;

    try {
        // Traer últimos N registros ordenados por fecha descendente
        const registros = await Registro.find()
            .sort({ fecha: -1 })
            .limit(Number(limite));

        // Revertir para que queden cronológicos para la gráfica
        registros.reverse();

        res.json({
            registros
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: 'Error al obtener registros'
        });
    }
}

const exportarCSV = async (req, res = response) => {
    try {
        const registros = await Registro.find().sort({ fecha: 1 });
        
        let csv = 'Fecha_ISO,Valor,TOPIC_MQTT\n';
        registros.forEach(r => {
            let valor = r.valor;
            // Si el valor es de tipo Json con .valor, sacarlo
            if (typeof valor === 'object' && valor.valor !== undefined) {
                valor = valor.valor;
            } else if (typeof valor === 'object') {
                valor = JSON.stringify(valor).replace(/,/g, ';');
            }
            csv += `${r.fecha.toISOString()},${valor},${r.topic}\n`;
        });

        res.header('Content-Type', 'text/csv');
        res.attachment('reporte_historico_tanque.csv');
        return res.send(csv);

    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: 'Error al generar CSV' });
    }
}

module.exports = {
    obtenerRegistros,
    exportarCSV
}
