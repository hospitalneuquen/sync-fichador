function substractOneDay(fecha){
    let tomorrow = new Date(fecha);
    return new Date(tomorrow.setDate(tomorrow.getDate() - 1));
}

function diffHours(date1, date2){
    return Math.abs(date1 - date2) / 36e5;
}

function parseDate(date){
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

module.exports = {
    substractOneDay: substractOneDay,
    diffHours: diffHours,
    parseDate: parseDate
}
