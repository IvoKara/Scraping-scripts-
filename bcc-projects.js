const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const url = 'https://www.bcc.bg/index1.php';
  await page.goto(url);
  
  /* Login */
  await page.evaluate(() => {
    const username = 's.ignatov@chb.bg';
    const password = '123';

    const form = document.querySelector('form:not([class]):not([id])');

    const usernameField = form.querySelector(':scope input[name=login]');
    const passwordField = form.querySelector(':scope input[name=pass]');

    usernameField.value = username;
    passwordField.value = password;

    const submitButton = form.querySelector(':scope button');
    submitButton.click();
  }); 

  console.log('Logged in');
  await page.waitForNavigation();

  /* Select all regions to search */
  await page.evaluate(() => {
    const selectAllRegions = document.querySelector('input#all_regions');
    selectAllRegions.click();

    const viewAll = document.querySelector('div#region a:first-child');
    viewAll.click();
  });

  console.log('Selected all regions');
  await page.waitForNavigation();

  const startPage = 40;
  const maxPages = 69;
  const itemsOnPage = 50;
  const mainUrl = page.url();

  for(var pageNumber = startPage - 1; pageNumber < maxPages; pageNumber++) {
    
    console.log(`Page number ${pageNumber + 1}`);

    const projectsData = [];

    const smartUrl = mainUrl + `?rLimit=${itemsOnPage}&page=${pageNumber}`;
    await page.goto(smartUrl);
    
    /* Collect projects URLs on page */
    const projectLinksOnPage = await page.evaluate(() => {
      const projectsOnPage = document.querySelectorAll('div.result-td.result-title');
      const links = [];
      for (const div of projectsOnPage) {
        const a = div.querySelector('a');
        links.push(`https://www.bcc.bg/${a.getAttribute('href')}`);
      }
      return links;
    });

    console.log(` Got ${projectLinksOnPage.length} links on page`);

    const subPage = await browser.newPage();

    const beforePush = projectsData.length;

    for(const subUrl of projectLinksOnPage) {
      await subPage.goto(subUrl);

      const data = {};
      data['name'] = await subPage.$eval(
        'h1', h1 => h1.textContent.replace('Досие за:', '').trim()
      );
      data['emails'] = await subPage.$$eval(
        'a[href*="mail"]', a => [...new Set(a.map(
          mail => mail.textContent.trim()
        ).slice(0, -1))]
      );
      data['frozen'] = await subPage.$('span.frozen') != null;

      if(Object.values(data).some(x => x == null || x == [])) {
        console.error(
          `Missing data in ${projectLinksOnPage.indexOf(subUrl) + 1} entry`
        );
      } else {
        projectsData.push(data);
      }
    }
    console.log(` Collected ${projectsData.length - beforePush} pieces of data`);

    const fs = require('fs');
    await fs.writeFile(
      `json/projects-data-bcc-${pageNumber + 1}.json`,
      JSON.stringify(projectsData, null, 2),
      (err) => err ? console.error('Data not written!', err) :
        console.log(` *Data written to "json/projects-data-bcc-${pageNumber}.json"!`)
    );
  }

  browser.close();
})();
