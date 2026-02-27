async function checkUrls() {
    const years = [2023, 2022, 2021, 2018];
    for (const year of years) {
        const url1 = `https://www.berkshirehathaway.com/letters/${year}ltr.pdf`;
        const url2 = `https://www.berkshirehathaway.com/letters/${year}.pdf`;

        let res = await fetch(url1, { method: 'HEAD', headers: { "User-Agent": "Mozilla/5.0" } });
        if (res.ok) {
            console.log(`FOUND ${year}: ${url1}`);
            continue;
        }

        res = await fetch(url2, { method: 'HEAD', headers: { "User-Agent": "Mozilla/5.0" } });
        if (res.ok) {
            console.log(`FOUND ${year}: ${url2}`);
            continue;
        }

        console.log(`NOT FOUND for ${year}`);
    }
}
checkUrls();
