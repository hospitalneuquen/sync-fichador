function substractOneDay(fecha){
    let tomorrow = new Date(fecha);
    return new Date(tomorrow.setDate(tomorrow.getDate() - 1));
}

function diffHours(date1, date2){
    // TODO Implementar!
    return 12;
}

function parseDate(date){
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

module.exports = {
    substractOneDay: substractOneDay,
    diffHours: diffHours,
    parseDate: parseDate
}
