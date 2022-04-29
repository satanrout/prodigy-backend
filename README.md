**Prodigy Backend Test**

**get started**

 - Clone the repo
 - Run "npm i" or  "npm install" to install dependencies
 - Create or edit the existing .env file accordingly.
 - Add your database details in "src/config/config.json"
 - Run "npm run dev" to run the project in development mode
 - Run "npm run build" to build the project
 - Run "npm run start" to run the project in development mode
 - Run "npm run migrate" to sync models with database

**packages used**

 - **axios** to for fetching data from external urls
 - **bcrypt** for password hashing
 - **cors** for cross origin compatibility
 - **dotenv** for environment variables
 - **express**  backend framework 
 - **Joi** for server side form validation
 - **jsonwebtoken** for authentication
 - **multer** for image uploads
 - **Sequelize** object relational mapping for mysql queries
 - **sharp**  to convert images to avif and webp
 - **nodemon** as a dev dependencies for development
 - **ts-node** to use types with typescript
 - **typescript** for typescript support
 
**Innovative feature**
used sharp to convert uploaded product images to both avif and webp.
avif and webp are efficient codec and it can be **500%** smaller compared to jpg or png which will result in a **faster** page load. currently some browsers don't support avif and webp but it can be fixed with html picture element.

if browser doesn't support avif it will try to use webp and if even webp is not supported then it will fallback to png which is supported by all the browsers even internet explorer.
