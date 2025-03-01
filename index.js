const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = 25622;

const fetchLevelData = async () => {
  try {
    const { data: html } = await axios.get('https://www.rickgdps.xyz/datastore/dashboard/stats/modActionsList.php', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const $ = cheerio.load(html);
    const ratedLevelSection = $('text.dltext:contains("Rated a level")').closest('.form-control');

    if (ratedLevelSection.length > 0) {
      const sectionHTML = ratedLevelSection.html();
      const idRegex = /<\/i>\s*(\d+)<\/div>/;
      const match = sectionHTML.match(idRegex);

      if (match && match[1]) {
        const levelID = match[1];
        const apiUrl = `https://www.rickgdps.xyz/datastore/dashboard/api/whoRated.php?level=${levelID}`;
        const response = await axios.get(apiUrl);

        if (response.data.success) {
          return { level: response.data.level, levelID: levelID, rates: response.data.rates };
        }
      }
    }
    return null;
  } catch (error) {
    return null;
  }
};

const fetchAdditionalInfo = async (levelID) => {
  try {
    const apiUrl = `https://www.rickgdps.xyz/datastore/dashboard/api/searchLevel.php?level=${levelID}`;
    const { data } = await axios.get(apiUrl);

    if (data.success && data.level) {
      const { name, desc, stats, diffuculty, author, song } = data.level;

      const rating = stats.featured ? "Featured Rated" : "Normal Rated";

      let epicRating = "Normal Rated";
      if (stats.epic === 1) epicRating = "Epic Rated";
      else if (stats.epic === 2) epicRating = "Legendary Rated";
      else if (stats.epic === 3) epicRating = "Mythical Rated";

      let demonDifficulty = "Not Demon";
      if (diffuculty.isDemon) {
        const demonDiff = diffuculty.demonDiff;
        if (demonDiff === 1) demonDifficulty = "Easy Demon";
        else if (demonDiff === 2) demonDifficulty = "Medium Demon";
        else if (demonDiff === 3) demonDifficulty = "Hard Demon";
        else if (demonDiff === 4) demonDifficulty = "Insane Demon";
        else if (demonDiff === 5) demonDifficulty = "Extreme Demon";
      }

      return {
        name,
        description: desc,
        stars: stats.stars,
        likes: stats.likes,
        downloads: stats.downloads,
        isRated: stats.isRated,
        rating,
        epicRating,
        demonDifficulty,
        song: {
          name: song.name,
          author: song.author,
          downloadLink: song.download
        },
        author: author.username
      };
    }
    return null;
  } catch (error) {
    return null;
  }
};

app.get('/api/newrate', async (req, res) => {
  let levelData = null;

  while (!levelData) {
    levelData = await fetchLevelData();
  }

  const additionalInfo = await fetchAdditionalInfo(levelData.levelID);

  if (additionalInfo) {
    res.json({
      levelID: levelData.levelID,
      levelName: additionalInfo.name,
      description: additionalInfo.description,
      stars: additionalInfo.stars,
      likes: additionalInfo.likes,
      downloads: additionalInfo.downloads,
      isRated: additionalInfo.isRated,
      rating: additionalInfo.rating,
      epicRating: additionalInfo.epicRating,
      demonDifficulty: additionalInfo.demonDifficulty,
      song: additionalInfo.song,
      author: additionalInfo.author,
      rates: levelData.rates
    });
  } else {
    res.status(500).json({ error: 'Failed to fetch additional level info' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
