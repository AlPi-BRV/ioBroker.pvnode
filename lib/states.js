'use strict';

/*
 * Object definitions and translations.
 *
 * All object names (states and channels) are given in the 11 ioBroker languages:
 * en, de, ru, pt, nl, fr, it, es, pl, uk, zh-cn.
 * Names that contain numbers (days, strings) are built from templates.
 */

const LANGS = ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'];

/**
 * Build a translation object from an array in LANGS order.
 *
 * @param {string[]} a texts in LANGS order
 */
function tr(a) {
    const o = {};
    LANGS.forEach((l, i) => (o[l] = a[i]));
    return o;
}

/**
 * Append a translated suffix to a translated name.
 *
 * @param {Record<string, string>} base translated name
 * @param {Record<string, string>} suffix translated suffix
 */
function withSuffix(base, suffix) {
    const o = {};
    for (const l of LANGS) {
        o[l] = l === 'zh-cn' ? `${base[l]}${suffix[l]}` : `${base[l]} ${suffix[l]}`;
    }
    return o;
}

const LOWER = tr([
    '(lower band)',
    '(unteres Band)',
    '(нижняя граница)',
    '(banda inferior)',
    '(onderste band)',
    '(bande inférieure)',
    '(banda inferiore)',
    '(banda inferior)',
    '(dolne pasmo)',
    '(нижня межа)',
    '（下限）',
]);
const UPPER = tr([
    '(upper band)',
    '(oberes Band)',
    '(верхняя граница)',
    '(banda superior)',
    '(bovenste band)',
    '(bande supérieure)',
    '(banda superiore)',
    '(banda superior)',
    '(górne pasmo)',
    '(верхня межа)',
    '（上限）',
]);

// ------------------------------------------------------------------ base names

const N = {
    power: tr([
        'PV power forecast',
        'PV-Leistung Prognose',
        'Прогноз мощности PV',
        'Previsão de potência FV',
        'Voorspeld PV-vermogen',
        'Prévision de puissance PV',
        'Previsione potenza FV',
        'Previsión de potencia FV',
        'Prognoza mocy PV',
        'Прогноз потужності PV',
        '光伏功率预测',
    ]),
    power_clearsky: tr([
        'PV power at clear sky',
        'PV-Leistung bei klarem Himmel',
        'Мощность PV при ясном небе',
        'Potência FV com céu limpo',
        'PV-vermogen bij heldere hemel',
        'Puissance PV par ciel clair',
        'Potenza FV a cielo sereno',
        'Potencia FV con cielo despejado',
        'Moc PV przy bezchmurnym niebie',
        'Потужність PV при ясному небі',
        '晴空光伏功率',
    ]),
    energy_next_hour: tr([
        'Expected energy next hour',
        'Erwartete Energie nächste Stunde',
        'Ожидаемая энергия в следующий час',
        'Energia esperada na próxima hora',
        'Verwachte energie komend uur',
        "Énergie attendue dans l'heure",
        'Energia prevista nella prossima ora',
        'Energía esperada en la próxima hora',
        'Oczekiwana energia w następnej godzinie',
        'Очікувана енергія наступної години',
        '未来一小时预计发电量',
    ]),
    slot_start: tr([
        'Start of current forecast slot',
        'Beginn des aktuellen Prognose-Intervalls',
        'Начало текущего интервала прогноза',
        'Início do intervalo de previsão atual',
        'Begin van huidig voorspellingsinterval',
        "Début de l'intervalle de prévision actuel",
        "Inizio dell'intervallo di previsione attuale",
        'Inicio del intervalo de previsión actual',
        'Początek bieżącego przedziału prognozy',
        'Початок поточного інтервалу прогнозу',
        '当前预测时段开始时间',
    ]),
    date: tr(['Date', 'Datum', 'Дата', 'Data', 'Datum', 'Date', 'Data', 'Fecha', 'Data', 'Дата', '日期']),
    energy: tr([
        'Energy forecast',
        'Energie Prognose',
        'Прогноз энергии',
        'Previsão de energia',
        'Energievoorspelling',
        "Prévision d'énergie",
        'Previsione energia',
        'Previsión de energía',
        'Prognoza energii',
        'Прогноз енергії',
        '发电量预测',
    ]),
    energy_clearsky: tr([
        'Energy at clear sky',
        'Energie bei klarem Himmel',
        'Энергия при ясном небе',
        'Energia com céu limpo',
        'Energie bij heldere hemel',
        'Énergie par ciel clair',
        'Energia a cielo sereno',
        'Energía con cielo despejado',
        'Energia przy bezchmurnym niebie',
        'Енергія при ясному небі',
        '晴空发电量',
    ]),
    remaining: tr([
        'Remaining energy today',
        'Restertrag heute',
        'Оставшаяся энергия сегодня',
        'Energia restante hoje',
        'Resterende energie vandaag',
        "Énergie restante aujourd'hui",
        'Energia residua oggi',
        'Energía restante hoy',
        'Pozostała energia dzisiaj',
        'Залишкова енергія сьогодні',
        '今日剩余发电量',
    ]),
    expected_so_far: tr([
        'Expected energy until now',
        'Erwarteter Ertrag bis jetzt',
        'Ожидаемая энергия до текущего момента',
        'Energia esperada até agora',
        'Verwachte energie tot nu toe',
        "Énergie attendue jusqu'à maintenant",
        'Energia prevista finora',
        'Energía esperada hasta ahora',
        'Oczekiwana energia do teraz',
        'Очікувана енергія до цього моменту',
        '截至目前的预计发电量',
    ]),
    peak_power: tr([
        'Peak power',
        'Spitzenleistung',
        'Пиковая мощность',
        'Potência de pico',
        'Piekvermogen',
        'Puissance de crête',
        'Potenza di picco',
        'Potencia pico',
        'Moc szczytowa',
        'Пікова потужність',
        '峰值功率',
    ]),
    peak_time: tr([
        'Time of peak power',
        'Uhrzeit der Spitzenleistung',
        'Время пиковой мощности',
        'Hora da potência de pico',
        'Tijdstip van piekvermogen',
        'Heure de la puissance de crête',
        'Ora della potenza di picco',
        'Hora de la potencia pico',
        'Godzina mocy szczytowej',
        'Час пікової потужності',
        '峰值功率时间',
    ]),
    temp_min: tr([
        'Minimum temperature',
        'Tiefsttemperatur',
        'Минимальная температура',
        'Temperatura mínima',
        'Minimumtemperatuur',
        'Température minimale',
        'Temperatura minima',
        'Temperatura mínima',
        'Temperatura minimalna',
        'Мінімальна температура',
        '最低温度',
    ]),
    temp_max: tr([
        'Maximum temperature',
        'Höchsttemperatur',
        'Максимальная температура',
        'Temperatura máxima',
        'Maximumtemperatuur',
        'Température maximale',
        'Temperatura massima',
        'Temperatura máxima',
        'Temperatura maksymalna',
        'Максимальна температура',
        '最高温度',
    ]),
    weather_code: tr([
        'Weather code (WMO)',
        'Wettercode (WMO)',
        'Код погоды (WMO)',
        'Código meteorológico (WMO)',
        'Weercode (WMO)',
        'Code météo (OMM)',
        'Codice meteo (WMO)',
        'Código meteorológico (OMM)',
        'Kod pogody (WMO)',
        'Код погоди (WMO)',
        '天气代码 (WMO)',
    ]),
    temp: tr([
        'Temperature',
        'Temperatur',
        'Температура',
        'Temperatura',
        'Temperatuur',
        'Température',
        'Temperatura',
        'Temperatura',
        'Temperatura',
        'Температура',
        '温度',
    ]),
    wind_speed: tr([
        'Wind speed',
        'Windgeschwindigkeit',
        'Скорость ветра',
        'Velocidade do vento',
        'Windsnelheid',
        'Vitesse du vent',
        'Velocità del vento',
        'Velocidad del viento',
        'Prędkość wiatru',
        'Швидкість вітру',
        '风速',
    ]),
    relative_humidity: tr([
        'Relative humidity',
        'Relative Luftfeuchtigkeit',
        'Относительная влажность',
        'Humidade relativa',
        'Relatieve luchtvochtigheid',
        'Humidité relative',
        'Umidità relativa',
        'Humedad relativa',
        'Wilgotność względna',
        'Відносна вологість',
        '相对湿度',
    ]),
    precipitation_mm: tr([
        'Precipitation',
        'Niederschlag',
        'Осадки',
        'Precipitação',
        'Neerslag',
        'Précipitations',
        'Precipitazioni',
        'Precipitación',
        'Opady',
        'Опади',
        '降水量',
    ]),
    snow_water_equivalent: tr([
        'Snow water equivalent',
        'Schnee-Wasser-Äquivalent',
        'Водный эквивалент снега',
        'Equivalente em água da neve',
        'Sneeuw-waterequivalent',
        'Équivalent en eau de la neige',
        'Equivalente in acqua della neve',
        'Equivalente en agua de la nieve',
        'Ekwiwalent wodny śniegu',
        'Водний еквівалент снігу',
        '雪水当量',
    ]),
    ghi: tr([
        'Global horizontal irradiance',
        'Globalstrahlung horizontal',
        'Глобальная горизонтальная освещённость',
        'Irradiância global horizontal',
        'Globale horizontale instraling',
        'Rayonnement global horizontal',
        'Irradianza globale orizzontale',
        'Irradiancia global horizontal',
        'Całkowite promieniowanie poziome',
        'Глобальна горизонтальна освітленість',
        '水平总辐照度',
    ]),
    dhi: tr([
        'Diffuse horizontal irradiance',
        'Diffusstrahlung horizontal',
        'Диффузная горизонтальная освещённость',
        'Irradiância difusa horizontal',
        'Diffuse horizontale instraling',
        'Rayonnement diffus horizontal',
        'Irradianza diffusa orizzontale',
        'Irradiancia difusa horizontal',
        'Rozproszone promieniowanie poziome',
        'Дифузна горизонтальна освітленість',
        '水平散射辐照度',
    ]),
    bni: tr([
        'Beam normal irradiance',
        'Direktnormalstrahlung',
        'Прямая нормальная освещённость',
        'Irradiância direta normal',
        'Directe normale instraling',
        'Rayonnement direct normal',
        'Irradianza diretta normale',
        'Irradiancia directa normal',
        'Bezpośrednie promieniowanie normalne',
        'Пряма нормальна освітленість',
        '法向直接辐照度',
    ]),
    gti: tr([
        'Irradiance on module plane',
        'Einstrahlung auf Modulebene',
        'Освещённость в плоскости модулей',
        'Irradiância no plano dos módulos',
        'Instraling op modulevlak',
        'Rayonnement sur le plan des modules',
        'Irradianza sul piano dei moduli',
        'Irradiancia en el plano de los módulos',
        'Promieniowanie na płaszczyźnie modułów',
        'Освітленість у площині модулів',
        '组件平面辐照度',
    ]),
    today_energy: tr([
        'Energy forecast today',
        'Energie Prognose heute',
        'Прогноз энергии на сегодня',
        'Previsão de energia hoje',
        'Energievoorspelling vandaag',
        "Prévision d'énergie aujourd'hui",
        'Previsione energia oggi',
        'Previsión de energía hoy',
        'Prognoza energii na dziś',
        'Прогноз енергії на сьогодні',
        '今日发电量预测',
    ]),
    tomorrow_energy: tr([
        'Energy forecast tomorrow',
        'Energie Prognose morgen',
        'Прогноз энергии на завтра',
        'Previsão de energia amanhã',
        'Energievoorspelling morgen',
        "Prévision d'énergie demain",
        'Previsione energia domani',
        'Previsión de energía mañana',
        'Prognoza energii na jutro',
        'Прогноз енергії на завтра',
        '明日发电量预测',
    ]),
    string_id: tr([
        'String ID',
        'String-ID',
        'ID стринга',
        'ID da string',
        'String-ID',
        'ID de la chaîne',
        'ID stringa',
        'ID del string',
        'ID stringu',
        'ID стрингу',
        '组串 ID',
    ]),
    orientation: tr([
        'Orientation (azimuth)',
        'Ausrichtung (Azimut)',
        'Ориентация (азимут)',
        'Orientação (azimute)',
        'Oriëntatie (azimut)',
        'Orientation (azimut)',
        'Orientamento (azimut)',
        'Orientación (azimut)',
        'Orientacja (azymut)',
        'Орієнтація (азимут)',
        '朝向（方位角）',
    ]),
    slope: tr([
        'Tilt',
        'Neigung',
        'Наклон',
        'Inclinação',
        'Hellingshoek',
        'Inclinaison',
        'Inclinazione',
        'Inclinación',
        'Nachylenie',
        'Нахил',
        '倾角',
    ]),
    power_kw: tr([
        'Installed power',
        'Installierte Leistung',
        'Установленная мощность',
        'Potência instalada',
        'Geïnstalleerd vermogen',
        'Puissance installée',
        'Potenza installata',
        'Potencia instalada',
        'Moc zainstalowana',
        'Встановлена потужність',
        '装机容量',
    ]),
};

/**
 * State definitions, looked up by the last segment of the state id.
 */
const DEFS = {
    power: { name: N.power, unit: 'W', role: 'value.power' },
    power_min: { name: withSuffix(N.power, LOWER), unit: 'W', role: 'value.power' },
    power_max: { name: withSuffix(N.power, UPPER), unit: 'W', role: 'value.power' },
    power_clearsky: { name: N.power_clearsky, unit: 'W', role: 'value.power' },
    energy_next_hour: { name: N.energy_next_hour, unit: 'kWh', role: 'value.energy' },
    slot_start: { name: N.slot_start, type: 'string', role: 'date' },

    date: { name: N.date, type: 'string', role: 'text' },
    energy: { name: N.energy, unit: 'kWh', role: 'value.energy' },
    energy_min: { name: withSuffix(N.energy, LOWER), unit: 'kWh', role: 'value.energy' },
    energy_max: { name: withSuffix(N.energy, UPPER), unit: 'kWh', role: 'value.energy' },
    energy_clearsky: { name: N.energy_clearsky, unit: 'kWh', role: 'value.energy' },
    remaining: { name: N.remaining, unit: 'kWh', role: 'value.energy' },
    remaining_min: { name: withSuffix(N.remaining, LOWER), unit: 'kWh', role: 'value.energy' },
    remaining_max: { name: withSuffix(N.remaining, UPPER), unit: 'kWh', role: 'value.energy' },
    expected_so_far: { name: N.expected_so_far, unit: 'kWh', role: 'value.energy' },
    peak_power: { name: N.peak_power, unit: 'W', role: 'value.power' },
    peak_time: { name: N.peak_time, type: 'string', role: 'text' },
    temp_min: { name: N.temp_min, unit: '°C', role: 'value.temperature.min' },
    temp_max: { name: N.temp_max, unit: '°C', role: 'value.temperature.max' },
    weather_code: { name: N.weather_code, role: 'value' },

    temp: { name: N.temp, unit: '°C', role: 'value.temperature' },
    wind_speed: { name: N.wind_speed, unit: 'm/s', role: 'value.speed.wind' },
    relative_humidity: { name: N.relative_humidity, unit: '%', role: 'value.humidity' },
    precipitation_mm: { name: N.precipitation_mm, unit: 'mm', role: 'value.precipitation' },
    snow_water_equivalent: { name: N.snow_water_equivalent, unit: 'mm', role: 'value' },
    ghi: { name: N.ghi, unit: 'W/m²', role: 'value.radiation' },
    dhi: { name: N.dhi, unit: 'W/m²', role: 'value.radiation' },
    bni: { name: N.bni, unit: 'W/m²', role: 'value.radiation' },
    gti: { name: N.gti, unit: 'W/m²', role: 'value.radiation' },

    today_energy: { name: N.today_energy, unit: 'kWh', role: 'value.energy' },
    today_remaining: { name: N.remaining, unit: 'kWh', role: 'value.energy' },
    tomorrow_energy: { name: N.tomorrow_energy, unit: 'kWh', role: 'value.energy' },

    string_id: { name: N.string_id, type: 'string', role: 'text' },
    orientation: { name: N.orientation, unit: '°', role: 'value' },
    slope: { name: N.slope, unit: '°', role: 'value' },
    power_kw: { name: N.power_kw, unit: 'kWp', role: 'value' },
};

// ------------------------------------------------------------------ channels

const CHANNELS = {
    info: tr([
        'Information',
        'Information',
        'Информация',
        'Informação',
        'Informatie',
        'Information',
        'Informazioni',
        'Información',
        'Informacje',
        'Інформація',
        '信息',
    ]),
    now: tr([
        'Current forecast values',
        'Aktuelle Prognosewerte',
        'Текущие значения прогноза',
        'Valores de previsão atuais',
        'Huidige voorspellingswaarden',
        'Valeurs de prévision actuelles',
        'Valori di previsione attuali',
        'Valores de previsión actuales',
        'Bieżące wartości prognozy',
        'Поточні значення прогнозу',
        '当前预测值',
    ]),
    today: tr([
        'Today',
        'Heute',
        'Сегодня',
        'Hoje',
        'Vandaag',
        "Aujourd'hui",
        'Oggi',
        'Hoy',
        'Dzisiaj',
        'Сьогодні',
        '今天',
    ]),
    tomorrow: tr([
        'Tomorrow',
        'Morgen',
        'Завтра',
        'Amanhã',
        'Morgen',
        'Demain',
        'Domani',
        'Mañana',
        'Jutro',
        'Завтра',
        '明天',
    ]),
    days: tr([
        'Daily forecast (0 = today)',
        'Tagesprognose (0 = heute)',
        'Прогноз по дням (0 = сегодня)',
        'Previsão diária (0 = hoje)',
        'Dagvoorspelling (0 = vandaag)',
        "Prévision journalière (0 = aujourd'hui)",
        'Previsione giornaliera (0 = oggi)',
        'Previsión diaria (0 = hoy)',
        'Prognoza dzienna (0 = dzisiaj)',
        'Прогноз по днях (0 = сьогодні)',
        '每日预测（0 = 今天）',
    ]),
    strings: tr([
        'Strings / module areas',
        'Strings / Modulflächen',
        'Стринги / поля модулей',
        'Strings / áreas de módulos',
        'Strings / moduledelen',
        'Chaînes / champs de modules',
        'Stringhe / campi moduli',
        'Strings / campos de módulos',
        'Stringi / pola modułów',
        'Стринги / поля модулів',
        '组串 / 组件区域',
    ]),
    weather: tr([
        'Weather and irradiance (current slot)',
        'Wetter und Einstrahlung (aktuelles Intervall)',
        'Погода и освещённость (текущий интервал)',
        'Tempo e irradiância (intervalo atual)',
        'Weer en instraling (huidig interval)',
        'Météo et rayonnement (intervalle actuel)',
        'Meteo e irradianza (intervallo attuale)',
        'Tiempo e irradiancia (intervalo actual)',
        'Pogoda i promieniowanie (bieżący przedział)',
        'Погода та освітленість (поточний інтервал)',
        '天气与辐照度（当前时段）',
    ]),
    json: tr([
        'JSON data for charts',
        'JSON-Daten für Diagramme',
        'Данные JSON для графиков',
        'Dados JSON para gráficos',
        'JSON-gegevens voor grafieken',
        'Données JSON pour graphiques',
        'Dati JSON per grafici',
        'Datos JSON para gráficos',
        'Dane JSON do wykresów',
        'Дані JSON для графіків',
        '图表 JSON 数据',
    ]),
    html: tr([
        'Ready-made SVG charts for VIS',
        'Fertige SVG-Diagramme für VIS',
        'Готовые SVG-графики для VIS',
        'Gráficos SVG prontos para VIS',
        'Kant-en-klare SVG-grafieken voor VIS',
        'Graphiques SVG prêts pour VIS',
        'Grafici SVG pronti per VIS',
        'Gráficos SVG listos para VIS',
        'Gotowe wykresy SVG dla VIS',
        'Готові SVG-графіки для VIS',
        '适用于 VIS 的现成 SVG 图表',
    ]),
    site: tr([
        'Site',
        'Standort',
        'Объект',
        'Local',
        'Locatie',
        'Site',
        'Sito',
        'Ubicación',
        'Lokalizacja',
        "Об'єкт",
        '站点',
    ]),
    control: tr([
        'Control',
        'Steuerung',
        'Управление',
        'Controlo',
        'Bediening',
        'Commande',
        'Controllo',
        'Control',
        'Sterowanie',
        'Керування',
        '控制',
    ]),
};

/** "In {n} days" for days.2 … days.7 */
const IN_DAYS = {
    en: n => `In ${n} days`,
    de: n => `In ${n} Tagen`,
    ru: n => `Через ${n} ${n >= 5 ? 'дней' : 'дня'}`,
    pt: n => `Daqui a ${n} dias`,
    nl: n => `Over ${n} dagen`,
    fr: n => `Dans ${n} jours`,
    it: n => `Tra ${n} giorni`,
    es: n => `Dentro de ${n} días`,
    pl: n => `Za ${n} dni`,
    uk: n => `Через ${n} ${n >= 5 ? 'днів' : 'дні'}`,
    'zh-cn': n => `${n} 天后`,
};

/** "String {n}: azimuth {az}°, tilt {slope}°, {kwp} kWp" */
const STRING_LABEL = tr([
    'azimuth|tilt',
    'Azimut|Neigung',
    'азимут|наклон',
    'azimute|inclinação',
    'azimut|helling',
    'azimut|inclinaison',
    'azimut|inclinazione',
    'azimut|inclinación',
    'azymut|nachylenie',
    'азимут|нахил',
    '方位角|倾角',
]);

/**
 * Name of a channel below "days" or "strings" (days.N, strings.N).
 *
 * @param {string} ch channel id, e.g. "days.3"
 */
function channelName(ch) {
    const [root, idx] = ch.split('.');
    const n = Number(idx);
    if (root === 'days') {
        if (n === 0) {
            return CHANNELS.today;
        }
        if (n === 1) {
            return CHANNELS.tomorrow;
        }
        const o = {};
        for (const l of LANGS) {
            o[l] = IN_DAYS[l](n);
        }
        return o;
    }
    if (root === 'strings') {
        const o = {};
        for (const l of LANGS) {
            o[l] = l === 'zh-cn' ? `组串 ${n + 1}` : `String ${n + 1}`;
        }
        return o;
    }
    return CHANNELS[root] || ch;
}

/**
 * Translated name of a string channel with its geometry.
 *
 * @param {number} i string index (0-based)
 * @param {{orientation?: number, slope?: number, power_kw?: number}} s string data from pvnode
 */
function stringChannelName(i, s) {
    const base = channelName(`strings.${i}`);
    const o = {};
    for (const l of LANGS) {
        const [az, tilt] = STRING_LABEL[l].split('|');
        o[l] = `${base[l]}: ${az} ${s.orientation}°, ${tilt} ${s.slope}°, ${s.power_kw} kWp`;
    }
    return o;
}

// ------------------------------------------------------------------ fixed states

/** States with fixed ids (info, site, json, html). */
const FIXED = {
    'info.connection': {
        type: 'boolean',
        role: 'indicator.connected',
        name: tr([
            'Connected to pvnode',
            'Verbunden mit pvnode',
            'Подключено к pvnode',
            'Ligado ao pvnode',
            'Verbonden met pvnode',
            'Connecté à pvnode',
            'Connesso a pvnode',
            'Conectado a pvnode',
            'Połączono z pvnode',
            'Підключено до pvnode',
            '已连接到 pvnode',
        ]),
    },
    'info.stale': {
        type: 'boolean',
        role: 'indicator',
        name: tr([
            'Forecast is outdated (last request failed)',
            'Prognose veraltet (letzte Abfrage fehlgeschlagen)',
            'Прогноз устарел (последний запрос не удался)',
            'Previsão desatualizada (último pedido falhou)',
            'Voorspelling verouderd (laatste aanvraag mislukt)',
            'Prévision obsolète (dernière requête échouée)',
            'Previsione obsoleta (ultima richiesta non riuscita)',
            'Previsión obsoleta (última solicitud fallida)',
            'Prognoza nieaktualna (ostatnie zapytanie nieudane)',
            'Прогноз застарів (останній запит не вдався)',
            '预测已过期（上次请求失败）',
        ]),
    },
    'info.lastError': {
        type: 'string',
        role: 'text',
        name: tr([
            'Last error',
            'Letzter Fehler',
            'Последняя ошибка',
            'Último erro',
            'Laatste fout',
            'Dernière erreur',
            'Ultimo errore',
            'Último error',
            'Ostatni błąd',
            'Остання помилка',
            '最近错误',
        ]),
    },
    'info.lastUpdate': {
        type: 'string',
        role: 'date',
        name: tr([
            'Last successful request',
            'Letzte erfolgreiche Abfrage',
            'Последний успешный запрос',
            'Último pedido bem-sucedido',
            'Laatste geslaagde aanvraag',
            'Dernière requête réussie',
            'Ultima richiesta riuscita',
            'Última solicitud correcta',
            'Ostatnie udane zapytanie',
            'Останній успішний запит',
            '上次成功请求',
        ]),
    },
    'info.computedAt': {
        type: 'string',
        role: 'text',
        name: tr([
            'Forecast computed at (pvnode)',
            'Prognose berechnet um (pvnode)',
            'Время расчёта прогноза (pvnode)',
            'Previsão calculada em (pvnode)',
            'Voorspelling berekend om (pvnode)',
            'Prévision calculée à (pvnode)',
            'Previsione calcolata alle (pvnode)',
            'Previsión calculada a las (pvnode)',
            'Prognoza obliczona o (pvnode)',
            'Час розрахунку прогнозу (pvnode)',
            '预测计算时间 (pvnode)',
        ]),
    },
    'info.nextPoll': {
        type: 'string',
        role: 'date',
        name: tr([
            'Next request',
            'Nächste Abfrage',
            'Следующий запрос',
            'Próximo pedido',
            'Volgende aanvraag',
            'Prochaine requête',
            'Prossima richiesta',
            'Próxima solicitud',
            'Następne zapytanie',
            'Наступний запит',
            '下次请求',
        ]),
    },
    'info.requestsLimit': {
        type: 'number',
        role: 'value',
        name: tr([
            'Monthly request limit (-1 = unlimited)',
            'Monatliches Anfragelimit (-1 = unbegrenzt)',
            'Месячный лимит запросов (-1 = без ограничений)',
            'Limite mensal de pedidos (-1 = ilimitado)',
            'Maandelijkse aanvraaglimiet (-1 = onbeperkt)',
            'Limite mensuelle de requêtes (-1 = illimité)',
            'Limite mensile di richieste (-1 = illimitato)',
            'Límite mensual de solicitudes (-1 = ilimitado)',
            'Miesięczny limit zapytań (-1 = bez limitu)',
            'Місячний ліміт запитів (-1 = без обмежень)',
            '每月请求上限（-1 = 无限制）',
        ]),
    },
    'info.requestsUsed': {
        type: 'number',
        role: 'value',
        name: tr([
            'Requests used this month',
            'Anfragen diesen Monat verbraucht',
            'Использовано запросов в этом месяце',
            'Pedidos usados este mês',
            'Aanvragen gebruikt deze maand',
            'Requêtes utilisées ce mois-ci',
            'Richieste usate questo mese',
            'Solicitudes usadas este mes',
            'Zapytania wykorzystane w tym miesiącu',
            'Використано запитів цього місяця',
            '本月已用请求数',
        ]),
    },
    'info.requestsRemaining': {
        type: 'number',
        role: 'value',
        name: tr([
            'Requests remaining this month (-1 = unlimited)',
            'Verbleibende Anfragen diesen Monat (-1 = unbegrenzt)',
            'Осталось запросов в этом месяце (-1 = без ограничений)',
            'Pedidos restantes este mês (-1 = ilimitado)',
            'Resterende aanvragen deze maand (-1 = onbeperkt)',
            'Requêtes restantes ce mois-ci (-1 = illimité)',
            'Richieste rimanenti questo mese (-1 = illimitato)',
            'Solicitudes restantes este mes (-1 = ilimitado)',
            'Pozostałe zapytania w tym miesiącu (-1 = bez limitu)',
            'Залишилось запитів цього місяця (-1 = без обмежень)',
            '本月剩余请求数（-1 = 无限制）',
        ]),
    },
    'info.requestsReset': {
        type: 'string',
        role: 'date',
        name: tr([
            'Request counter reset',
            'Zurücksetzung des Anfragezählers',
            'Сброс счётчика запросов',
            'Reposição do contador de pedidos',
            'Reset van aanvraagteller',
            'Réinitialisation du compteur de requêtes',
            'Azzeramento del contatore richieste',
            'Reinicio del contador de solicitudes',
            'Reset licznika zapytań',
            'Скидання лічильника запитів',
            '请求计数器重置时间',
        ]),
    },
    'info.availableGroups': {
        type: 'string',
        role: 'text',
        name: tr([
            'Data groups allowed by plan',
            'Vom Plan erlaubte Datengruppen',
            'Группы данных, разрешённые тарифом',
            'Grupos de dados permitidos pelo plano',
            'Door abonnement toegestane gegevensgroepen',
            "Groupes de données autorisés par l'offre",
            'Gruppi di dati consentiti dal piano',
            'Grupos de datos permitidos por el plan',
            'Grupy danych dozwolone w planie',
            'Групи даних, дозволені тарифом',
            '套餐允许的数据组',
        ]),
    },
    'info.variability': {
        type: 'boolean',
        role: 'indicator',
        name: tr([
            'Variability band available',
            'Schwankungsband verfügbar',
            'Диапазон колебаний доступен',
            'Banda de variabilidade disponível',
            'Variabiliteitsband beschikbaar',
            'Bande de variabilité disponible',
            'Banda di variabilità disponibile',
            'Banda de variabilidad disponible',
            'Pasmo zmienności dostępne',
            'Діапазон коливань доступний',
            '波动区间可用',
        ]),
    },
    'info.forecastDays': {
        type: 'number',
        role: 'value',
        name: tr([
            'Number of forecast days',
            'Anzahl Prognosetage',
            'Количество дней прогноза',
            'Número de dias de previsão',
            'Aantal voorspellingsdagen',
            'Nombre de jours de prévision',
            'Numero di giorni di previsione',
            'Número de días de previsión',
            'Liczba dni prognozy',
            'Кількість днів прогнозу',
            '预测天数',
        ]),
    },
    'info.cache': {
        type: 'string',
        role: 'json',
        name: tr([
            'Cached forecast (internal)',
            'Zwischengespeicherte Prognose (intern)',
            'Кэшированный прогноз (внутренний)',
            'Previsão em cache (interno)',
            'Gecachte voorspelling (intern)',
            'Prévision en cache (interne)',
            'Previsione in cache (interna)',
            'Previsión en caché (interna)',
            'Prognoza w pamięci podręcznej (wewnętrzna)',
            'Кешований прогноз (внутрішній)',
            '缓存的预测（内部）',
        ]),
    },
    'site.name': {
        type: 'string',
        role: 'text',
        name: tr([
            'Site name',
            'Name des Standorts',
            'Название объекта',
            'Nome do local',
            'Naam van de locatie',
            'Nom du site',
            'Nome del sito',
            'Nombre de la ubicación',
            'Nazwa lokalizacji',
            "Назва об'єкта",
            '站点名称',
        ]),
    },
    'site.id': {
        type: 'string',
        role: 'text',
        name: tr([
            'Site ID',
            'Standort-ID',
            'ID объекта',
            'ID do local',
            'Locatie-ID',
            'ID du site',
            'ID del sito',
            'ID de la ubicación',
            'ID lokalizacji',
            "ID об'єкта",
            '站点 ID',
        ]),
    },
    'site.power_kw': { type: 'number', role: 'value', unit: 'kWp', name: N.power_kw },
    'json.forecast': {
        type: 'string',
        role: 'json',
        name: tr([
            'Full forecast series',
            'Komplette Prognosekurve',
            'Полный ряд прогноза',
            'Série de previsão completa',
            'Volledige voorspellingsreeks',
            'Série de prévision complète',
            'Serie di previsione completa',
            'Serie de previsión completa',
            'Pełna seria prognozy',
            'Повний ряд прогнозу',
            '完整预测序列',
        ]),
    },
    'json.today': {
        type: 'string',
        role: 'json',
        name: tr([
            'Forecast series today',
            'Prognosekurve heute',
            'Ряд прогноза на сегодня',
            'Série de previsão de hoje',
            'Voorspellingsreeks vandaag',
            "Série de prévision d'aujourd'hui",
            'Serie di previsione di oggi',
            'Serie de previsión de hoy',
            'Seria prognozy na dziś',
            'Ряд прогнозу на сьогодні',
            '今日预测序列',
        ]),
    },
    'json.daily': {
        type: 'string',
        role: 'json',
        name: tr([
            'Daily forecast',
            'Tagesprognose',
            'Прогноз по дням',
            'Previsão diária',
            'Dagvoorspelling',
            'Prévision journalière',
            'Previsione giornaliera',
            'Previsión diaria',
            'Prognoza dzienna',
            'Прогноз по днях',
            '每日预测',
        ]),
    },
    'html.today': {
        type: 'string',
        role: 'html',
        name: tr([
            'SVG chart: power curve today',
            'SVG-Diagramm: Leistungskurve heute',
            'SVG-график: кривая мощности сегодня',
            'Gráfico SVG: curva de potência hoje',
            'SVG-grafiek: vermogenscurve vandaag',
            "Graphique SVG : courbe de puissance aujourd'hui",
            'Grafico SVG: curva di potenza oggi',
            'Gráfico SVG: curva de potencia hoy',
            'Wykres SVG: krzywa mocy dzisiaj',
            'SVG-графік: крива потужності сьогодні',
            'SVG 图表：今日功率曲线',
        ]),
    },
    'html.tomorrow': {
        type: 'string',
        role: 'html',
        name: tr([
            'SVG chart: power curve tomorrow',
            'SVG-Diagramm: Leistungskurve morgen',
            'SVG-график: кривая мощности завтра',
            'Gráfico SVG: curva de potência amanhã',
            'SVG-grafiek: vermogenscurve morgen',
            'Graphique SVG : courbe de puissance demain',
            'Grafico SVG: curva di potenza domani',
            'Gráfico SVG: curva de potencia mañana',
            'Wykres SVG: krzywa mocy jutro',
            'SVG-графік: крива потужності завтра',
            'SVG 图表：明日功率曲线',
        ]),
    },
    'html.days': {
        type: 'string',
        role: 'html',
        name: tr([
            'SVG chart: daily energy',
            'SVG-Diagramm: Tagesertrag',
            'SVG-график: энергия по дням',
            'Gráfico SVG: energia diária',
            'SVG-grafiek: dagopbrengst',
            'Graphique SVG : énergie journalière',
            'Grafico SVG: energia giornaliera',
            'Gráfico SVG: energía diaria',
            'Wykres SVG: energia dzienna',
            'SVG-графік: енергія по днях',
            'SVG 图表：每日发电量',
        ]),
    },
};

const REFRESH_NAME = tr([
    'Refresh forecast now (costs one request)',
    'Prognose jetzt abrufen (kostet eine Anfrage)',
    'Обновить прогноз сейчас (стоит один запрос)',
    'Atualizar previsão agora (custa um pedido)',
    'Voorspelling nu vernieuwen (kost één aanvraag)',
    'Actualiser la prévision maintenant (coûte une requête)',
    'Aggiorna la previsione ora (costa una richiesta)',
    'Actualizar la previsión ahora (cuesta una solicitud)',
    'Odśwież prognozę teraz (kosztuje jedno zapytanie)',
    'Оновити прогноз зараз (коштує один запит)',
    '立即刷新预测（消耗一次请求）',
]);

/**
 * Common definition for a relative state id.
 *
 * @param {string} id relative id, e.g. "today.energy"
 */
function commonFor(id) {
    const fixed = FIXED[id];
    const last = id.split('.').pop();
    const d = fixed || DEFS[last] || { name: last, role: 'value' };
    const common = {
        name: d.name,
        type: d.type || 'number',
        role: d.role,
        read: true,
        write: false,
    };
    if (d.unit) {
        common.unit = d.unit;
    }
    return common;
}

module.exports = { LANGS, DEFS, CHANNELS, FIXED, REFRESH_NAME, commonFor, channelName, stringChannelName };
