const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const databasePath = path.join(__dirname, "covid19IndiaPortal.db");

let dataBase = null;

const initializeDBAndServer = async () => {
  try {
    dataBase = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DataBase Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const convertStateDBObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDBObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

// POST LOGIN API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await dataBase.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// GET STATES API
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT 
        *
    FROM
        state;
    `;
  const statesArray = await dataBase.all(getStatesQuery);
  response.send(
    statesArray.map((eachState) =>
      convertStateDBObjectToResponseObject(eachState)
    )
  );
});

// GET STATE API
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT 
        *
    FROM
        state
    WHERE
        state_id = ${stateId};
    `;
  const stateDetails = await dataBase.get(getStateQuery);
  response.send(convertStateDBObjectToResponseObject(stateDetails));
});

//GET DISTRICT API
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT 
        *
    FROM
        district
    WHERE
        district_id = ${districtId};
    `;
    const districtDetails = await dataBase.get(getDistrictQuery);
    response.send(convertDistrictDBObjectToResponseObject(districtDetails));
  }
);

//GET STATES STATS API
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateQuery = `
    SELECT 
        sum(cases) AS totalCases,
        sum(cured) AS totalCured,
        sum(active) AS totalActive,
        sum(deaths) AS totalDeaths
    FROM
        district
    WHERE
        state_id = ${stateId};
    `;
    const stateStats = await dataBase.get(getStateQuery);
    response.send(stateStats);
  }
);

//GET DISTRICT DETAILS API
app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT 
        state_name AS stateName
    FROM
        state INNER JOIN district ON state.state_id = district.state_id
    WHERE
        district.district_id = ${districtId};
    `;
    const districtDetails = await dataBase.get(getDistrictQuery);
    response.send(districtDetails);
  }
);

// POST DISTRICTS API
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `
  INSERT INTO 
    district (district_name, state_id, cases, cured, active, deaths)
  VALUES 
    ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});
  `;

  const postDistrict = await dataBase.run(postDistrictQuery);
  response.send("District Successfully Added");
});

// DELETE DISTRICT API
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM
        district
    WHERE
        district_id = ${districtId};
    `;
    await dataBase.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// PUT DISTRICT API
app.put(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
    UPDATE
        district
    SET 
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    WHERE 
        district_id = ${districtId};`;

    const updatedDistrict = await dataBase.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

// GET DISTRICTS API
app.get("/districts/", authenticateToken, async (request, response) => {
  const getDistrictsQuery = `
    SELECT 
        *
    FROM
        district;
    `;
  const districtsArray = await dataBase.all(getDistrictsQuery);
  response.send(
    districtsArray.map((eachDistrict) =>
      convertDistrictDBObjectToResponseObject(eachDistrict)
    )
  );
});

module.exports = app;
