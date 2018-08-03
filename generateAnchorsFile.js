var fs = require('fs');
var axios = require('axios');

var urls = {
    "anchor-measurements": "https://atlas.ripe.net/api/v2/anchor-measurements/?format=json&include=target,measurement&page_size=500",

};


function anchorMeasurementTranslate(item){
    if (item.measurement.af != 4 || item.measurement.type != "traceroute"){
        return null;
    } else {

        var obj = {
            "country_code": item.target.country,
            "asn_v4": item.target.as_v4,
            "id": item.id,
            "city": item.target.city,
            "country": item.target.country,
            "v4_msm_id": item.measurement.id
        };

        return obj;

    }

}

function readPage(url, results, resolve){

    axios.get(url)
        .then(function (response) {
            return response.data;
        })
        .then(function(data){
            var translated = data.results.map(anchorMeasurementTranslate).filter(function(item){ return item != null; });
            results = results.concat(translated);

            if (data.next == null){
                resolve(results);
            } else {
                readPage(data.next, results, resolve);
            }
        })


}

new Promise(function(resolve, reject) {
    console.log("Downloading data...");
    readPage(urls["anchor-measurements"], [], resolve);
})
    .then(data => {
        fs.writeFileSync('anchors.json', JSON.stringify(data));
        console.log("Done!");
    });