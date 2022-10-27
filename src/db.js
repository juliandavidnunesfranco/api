require('dotenv').config()
const axios = require('axios')
const { Sequelize } = require('sequelize')
const fs = require('fs')
const path = require('path')
const { DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, NODE_ENV, API_KEY } = process.env;

const sequelize =
    NODE_ENV === "production"
        ? new Sequelize({
            database: DB_NAME,
            dialect: "postgres",
            host: DB_HOST,
            port: 5432,
            username: DB_USER,
            password: DB_PASSWORD,
            pool: {
                max: 3,
                min: 1,
                idle: 10000
            },
            dialectOptions: {
                ssl: {
                    require: true,
                    rejectUnauthorized: false
                },
                keepAlive: true,
            },
            ssl: true,
        })
        :
        new Sequelize(
            `postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`,
            {
                logging: false, // set to console.log to see the raw SQL queries
                native: false, // lets Sequelize know we can use pg-native for ~30% more speed

            }
        );



const basename = path.basename(__filename)

const modelDefiners = []

// Leemos todos los archivos de la carpeta Models, los requerimos y agregamos al arreglo modelDefiners
fs.readdirSync(path.join(__dirname, '/models'))
  .filter(
    (file) =>
      file.indexOf('.') !== 0 && file !== basename && file.slice(-3) === '.js',
  )
  .forEach((file) => {
    modelDefiners.push(require(path.join(__dirname, '/models', file)))
  })

// Injectamos la conexion (sequelize) a todos los modelos   ////------>>>sincronizacion db to sequelize
modelDefiners.forEach((model) => model(sequelize))
// Capitalizamos los nombres de los modelos ie: product => Product
let entries = Object.entries(sequelize.models)
let capsEntries = entries.map((entry) => [
  entry[0][0].toUpperCase() + entry[0].slice(1),
  entry[1],
])
sequelize.models = Object.fromEntries(capsEntries)

// En sequelize.models están todos los modelos importados como propiedades
// Para relacionarlos hacemos un destructuring
const { Videogame, Genre, Platform } = sequelize.models

// Aca vendrian las relaciones
// Product.hasMany(Reviews);     muchos a muchos

Videogame.belongsToMany(Genre, { through: 'videogame_genre' })
Genre.belongsToMany(Videogame, { through: 'videogame_genre' })


Videogame.belongsToMany(Platform, {
  through: 'videogame_platform',
  as: 'platforms_videogames',
})

Platform.belongsToMany(Videogame, {
  through: 'videogame_platform',
  as: 'platforms_videogames',
})

////  axios --> se usa para cargar los genres a DB  ////
/* let urlGenre =`https://api.rawg.io/api/genres?key=${API_KEY}`

const getInfoGenre = async () => {
  let genres;
  try {
    await axios.get(urlGenre)
    .then(response => genres = response.data.results.map((q) => q.name))
    genres.forEach(e => {
      Genre.findOrCreate({
        where: {
          name: e
        }
      });
    });
    console.log('Loaded the DB of genre')
  } catch (e) {
    console.log(e);
  };
};
getInfoGenre();  ///alimento la DB  de los genres
 */

module.exports = {
  ...sequelize.models, // para poder importar los modelos así: const { Product, User } = require('./db.js');
  conn: sequelize, // para importart la conexión { conn } = require('./db.js');
}
