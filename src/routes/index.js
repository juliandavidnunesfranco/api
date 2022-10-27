const { Router } = require('express')
const { Op } = require('sequelize')
const {
  Videogame,
  Genre,
  Platform,
  platforms_videogames,
  videogames_platforms,
} = require('../db.js')
const { API_KEY } = process.env
const axios = require('axios')

// Importar todos los routers;
// Ejemplo: const authRouter = require('./auth.js');

const router = Router()
// Configurar los routers
// Ejemplo: router.use('/auth', authRouter);

//const routeGenres = require('./routeGenres');
//router.use('/genres', routeGenres);
/* ///----->>>la ruta del genre estara en otra parte<<<<-------//// */

////------>>> CONTROLLERS--primero el que trae todos los videogames

const getVideogames = async () => {
  let videoGames = []

  let page = 1

  while (videoGames.length < 100) {
    let response = await axios.get(
      `https://api.rawg.io/api/games?key=${API_KEY}&page=${page}`,
    ) //  la variable response es la que trae todo
    response.data.results.map((el) => {
      // capturo la rspuesta xq es asincrono
      videoGames.push({
        id: el.id,
        name: el.name,
        image: el.background_image,
        release: el.released,
        rating: el.rating,
        platforms: el.platforms.map((ch) => ch.platform.name),
        genres: el.genres.map((ch) => ch.name),
      })
    })
    page++
  }
  return videoGames
}

const getDbInfo = async () => {
  return await Videogame.findAll({
    //db
    include: [
      {
        model: Genre,
        as: 'genres',
        attributes: ['id', 'name'],
      },
      {
        model: Platform,
        as: 'platforms_videogames',
        attributes: ['id', 'name'],
      },
    ],
  })
}

const getAllVideogames = async () => {
  let apiInfo = await getVideogames() // apiInfo == getVideogames() ejecutado
  let dbInfoP = await getDbInfo() // dbInfoP == getDbInfo() ejecutado   con p al final
  let dbInfo = dbInfoP.map((el) => {
    //  dbInfo --->> se mapea adicionando mas features
    return {
      id: el.id,
      name: el.name,
      description: el.description,
      image: el.image,
      release: el.release,
      rating: el.rating,
      platforms: el.platforms.map((ch) => ch),
      genres: el.genres.map((ch) => ch.name),
      createdInDB: el.createdInDB || false,
    }
  })
  let infoTotal = apiInfo.concat(dbInfo) //  se concatenan los vidogames del api con los de db interna
  return infoTotal
}

const getVideogameById = async (id) => {
  // function que tiene como parametro un id
  if (id.length < 7) {
    let apiUrl = await axios.get(
      `https://api.rawg.io/api/games/${id}?key=${API_KEY}`,
    ) // segundo endpoint de la api externa
    let apiInfo = await apiUrl.data
    return {
      name: apiInfo.name,
      image: apiInfo.background_image,
      description: apiInfo.description,
      release: apiInfo.released,
      rating: apiInfo.rating,
      platforms: apiInfo.platforms.map((ch) => ch.platform.name),
      genres: apiInfo.genres.map((ch) => ch.name),
    }
  } else {
    let gameID = await Videogame.findByPk(id, { include: Genre })
    let aux = gameID.dataValues
    //console.log(aux)
    return {
      name: aux.name,
      image: aux.image,
      description: aux.description,
      release: aux.release,
      rating: aux.rating,
      platforms: aux.platforms.map((ch) => ch),
      genres: aux.genres.map((ch) => ch.name),
    }
  }
}

const returnVideoGame = async (id) => {
  let game = await getVideogameById(id)
  return game
}

//------>>>>CARGAR 50 videogames a data base----<<<<///

//------>>>//--ROUTES--//<<<------//

router.get('/videogames', async (req, res) => {
  const name = req.query.name
  try {
    if (!name) {
      let gamesTotal = await getAllVideogames()
      res.status(200).send(gamesTotal)
    } else {
      let gamesFromApi = await axios.get(
        `https://api.rawg.io/api/games?search=${name}&key=${API_KEY}`,
      )
      let gameApi = gamesFromApi.data.results.map((el) => {
        return {
          id: el.id,
          name: el.name,
          image: el.background_image,
          release: el.released,
          rating: el.rating,
          platforms: el.platforms.map((ch) => ch.platforms), //valor name ?
          genres: el.genres.map((ch) => ch.name),
          createdInDB: el.createdInDB,
        }
      })
      let gamesFromDB = await Videogame.findAll({
        where: {
          name: { [Op.iLike]: '%' + name + '%' },
        },
        include: Genre,
      })
      console.log('games from bd --->> ' + gamesFromDB)

      let gameDb = gamesFromDB.map((el) => {
        return {
          id: el.id,
          name: el.name,
          description: el.description,
          image: el.image,
          release: el.release,
          rating: el.rating,
          platforms: el.platforms.map((ch) => ch),
          genres: el.genres.map((ch) => ch.name),
          createdInDB: el.createdInDB,
        }
      })
      let gameTotal = gameApi.concat(gameDb)
      res.status(200).send(gameTotal)
    }
  } catch (error) {
    console.log(error)
  }
})

router.post('/videogames', async (req, res) => {
  try {
    let {
      name,
      description,
      image, ///options
      release,
      rating,
      platforms,
      genres,
      createdInDB,
    } = req.body

    if (name) {
      try {
        const thevideogame = await getAllVideogames()
        const anVideogame = thevideogame.find(
          (e) => e.name.toLowerCase() === name.toLowerCase(),
        )
        if (anVideogame) {
          return res.send('the video game exist')
        }

        let gameCreated = await Videogame.create({
          name,
          description,
          image, //options
          release,
          rating,
          platforms,
          createdInDB,
        })
        let genreDb = await Genre.findAll({ where: { name: genres } })
        let platformDb = await Platform.findAll({ where: { name: platforms } })
        gameCreated.addGenre(genreDb)
        gameCreated.addPlatform(platformDb)

        res.send('Videogame successfully created!')
      } catch (error) {
        console.log(error)
      }
    }
    if (!name) return res.status(400).send('Videogame name is obligtory')
  } catch (error) {
    console.log(error)
  }
})

router.get('/videogames/:id', async (req, res) => {
  try {
    let id = req.params.id
    if (id) {
      let gameId = await returnVideoGame(id)
      Object.entries(gameId).length !== 0
        ? res.status(200).send(gameId)
        : res.status(400).send('Video Game not found')
    }
  } catch (error) {
    console.log(error)
  }
})

router.get('/genres', async (req, res) => {
  try {
    let generos = await axios.get(
      `https://api.rawg.io/api/genres?key=${API_KEY}`,
    )
    let response = generos.data.results.map((el) => {
      return {
        name: el.name,
      }
    })

    response.forEach(async (e) => {
      await Genre.findOrCreate({
        where: {
          name: e.name,
        },
      })
    })

    let allGenres = await Genre.findAll()
    return res.json(allGenres)
  } catch (error) {
    console.error(error)
    res.send(error)
  }
})

router.post('/genres', async (req, res) => {
  try {
    let { name } = req.body
    let newGenre = await Genre.create({ name: name })
    //console.log(newGenre)
    res.status(200).send(newGenre)
    console.log('Genre successfully created!')
  } catch (error) {
    res.send(error)
  }
})

router.get('/platforms', async (req, res) => {
  try {
    let platformApi = await axios.get(
      `https://api.rawg.io/api/platforms/lists/parents?key=${API_KEY}`,
    )
    let platforms = platformApi.data.results.map((e) => e.name)
    let id = platformApi.data.results.map((e) => e.id)

    platforms.forEach((e, i) => {
      Platform.findOrCreate({
        where: { name: e, id: id[i] },
      })
    })
    const allPlatforms = await Platform.findAll()
    res.send(allPlatforms)
  } catch (error) {
    console.log(error)
  }
})

module.exports = router
