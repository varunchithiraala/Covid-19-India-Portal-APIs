const express = require("express");
const {open} = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const dbPath = path.join(__dirname,"covid19IndiaPortal.db");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken"); 

const app = express();
app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
    try {
            db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });
        app.listen(3000, () => {
            console.log("Server Running at http://localhost:3000/");
        });
    } catch(e) {
        console.log(`DB Error: ${e.message}`);
        process.exit(1);
    }
};

initializeDBAndServer();

const convertStateDBObjectToResponseObject = (dbResponse) => {
    return {
        stateId: dbResponse.state_id,
        stateName: dbResponse.state_name,
        population: dbResponse.population
    };
};

const convertDistrictDBObjectToResponseObject = (dbResponse) => {
    return {
        districtId: dbResponse.district_id,
        districtName: dbResponse.district_name,
        stateId: dbResponse.state_id,
        cases: dbResponse.cases,
        cured: dbResponse.cured,
        active: dbResponse.active,
        deaths: dbResponse.deaths
    };
};

//Authenticate User API
const authenticateToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined){
        jwtToken = authHeader.split(" ")[1]
    } 
    if (jwtToken === undefined) {
        response.status(401);
        response.send("Invalid JWT Token");
    } else {
        jwt.verify(jwtToken, "THE_SECRET_KEY", async (error, payload) => {
            if (error) {
                response.status(401);
                response.send("Invalid JWT Token");
            } else {
                next();
            }
        });
    }
};

//Login User API
app.post("/login/", async (request, response) => {
    const {username, password} = request.body;
    const selectUserQuery = `
    SELECT
      * 
    FROM
      user
    WHERE
      username = '${username}';`;
    const dbUser = await db.get(selectUserQuery);
    if (dbUser === undefined) {
        response.status(400);
        response.send("Invalid user");
    } else {
        isPasswordMatched = await bcrypt.compare(password,dbUser.password);
        if (isPasswordMatched) {
            const payload = {
                username: username
            };
            const jwtToken = jwt.sign(payload,"THE_SECRET_KEY");
            response.send({jwtToken});
        } else {
            response.status(400);
            response.send("Invalid password");
        }
    }
});

//Get States API
app.get("/states/", authenticateToken, async (request, response) => {
    const getStatesQuery = `
    SELECT
      *
    FROM
      state
    ORDER BY
      state_id;`;
    const statesArray = await db.all(getStatesQuery);
    response.send(
        statesArray.map((eachState) => 
            convertStateDBObjectToResponseObject(eachState)
        )
    );
});

//Get State API
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
    const {stateId} = request.params;
    const getStateQuery = `
    SELECT
      *
    FROM
      state
    WHERE
      state_id = '${stateId}';`;
    const stateDetails = await db.get(getStateQuery);
    response.send(convertStateDBObjectToResponseObject(stateDetails));
});

//Add District API
app.post("/districts/", authenticateToken, async (request, response) => {
    const {districtName, stateId, cases, cured, active, deaths} = request.body;
    const addDistrictQuery = `
    INSERT INTO
      district (district_name, state_id, cases, cured, active, deaths)
    VALUES (
        '${districtName}',
         ${stateId},
         ${cases},
         ${cured},
         ${active},
         ${deaths}
        );`;
    await db.run(addDistrictQuery);
    response.send("District Successfully Added");
});

//Get District API
app.get("/districts/:districtId/", authenticateToken, async (request, response) => {
    const {districtId} = request.params;
    const getDistrictQuery = `
    SELECT
      *
    FROM
      district
    WHERE
      district_id = ${districtId};`;
    const districtDetails = await db.get(getDistrictQuery);
    response.send(convertDistrictDBObjectToResponseObject(districtDetails));
});

//Delete District API
app.delete("/districts/:districtId/", authenticateToken, async (request, response) => {
    const {districtId} = request.params;
    const deleteDistrictQuery = `
    DELETE FROM
      district
    WHERE
      district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
});

//Update District API
app.put("/districts/:districtId/", authenticateToken, async (request, response) => {
    const {districtId} = request.params;
    const {districtName, stateId, cases, cured, active, deaths} = request.body;
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
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
});

//Get State Stats API
app.get("/states/:stateId/stats/", authenticateToken, async (request, response) => {
    const {stateId} = request.params;
    const getStateStatsQuery = `
    SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
      district
    WHERE
      state_id = ${stateId};`;
    const stateStatsDetails = await db.get(getStateStatsQuery);
    response.send({
      totalCases: stateStatsDetails["SUM(cases)"],
      totalCured: stateStatsDetails["SUM(cured)"],
      totalActive: stateStatsDetails["SUM(active)"],
      totalDeaths: stateStatsDetails["SUM(deaths)"]
    });
});

module.exports = app;