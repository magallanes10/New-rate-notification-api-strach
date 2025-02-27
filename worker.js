import * as cheerio from 'cheerio';
async function fetchLevelData() {
  try {
    const response = await fetch('https://www.rickgdps.xyz/datastore/dashboard/stats/modActionsList.php', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.ok) throw new Error('Failed to fetch mod actions list');

    const html = await response.text();
    const $ = cheerio.load(html);
    const ratedLevelSection = $('text.dltext:contains("Rated a level")').closest('.form-control');

    if (ratedLevelSection.length > 0) {
      const sectionHTML = ratedLevelSection.html();
      const idRegex = /<\/i>\s*(\d+)<\/div>/;
      const match = sectionHTML.match(idRegex);

      if (match && match[1]) {
        const levelID = match[1];
        const apiUrl = `https://www.rickgdps.xyz/datastore/dashboard/api/whoRated.php?level=${levelID}`;
        const ratingResponse = await fetch(apiUrl);

        if (ratingResponse.ok) {
          const ratingData = await ratingResponse.json();
          if (ratingData.success) {
            return { level: ratingData.level, levelID: levelID, rates: ratingData.rates };
          }
        }
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function fetchAdditionalInfo(levelID) {
  try {
    const apiUrl = `https://www.rickgdps.xyz/datastore/dashboard/api/searchLevel.php?level=${levelID}`;
    const response = await fetch(apiUrl);

    if (!response.ok) throw new Error('Failed to fetch level info');

    const data = await response.json();

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
        const demonDiffMap = ["Easy Demon", "Medium Demon", "Hard Demon", "Insane Demon", "Extreme Demon"];
        demonDifficulty = demonDiffMap[demonDiff - 1] || "Unknown Demon";
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
          downloadLink: song.download,
        },
        author: author.username,
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/api/newrate') {
      let levelData = null;

      while (!levelData) {
        levelData = await fetchLevelData();
      }

      const additionalInfo = await fetchAdditionalInfo(levelData.levelID);

      if (additionalInfo) {
        return new Response(
          JSON.stringify({
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
            rates: levelData.rates,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(JSON.stringify({ error: 'Failed to fetch additional level info' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Invalid route', { status: 404 });
  },
};
