/*
    read from cs.json by synchronous request
*/
var fs = require('fs');
var wesmap_JSON = JSON.parse(fs.readFileSync('./public/cs.json', 'utf8'));
//[{"ARAB": ["Elementary Arabic I", "Intermediate Arabic I", "Advanced Arabic I", "Elementary Arabic II", "Intermediate Arabic II"]}]
var allMajors = [];
for (var key in wesmap_JSON) {
  if (wesmap_JSON.hasOwnProperty(key)) {
    var major_JSON = wesmap_JSON[key]
    allMajors.push(Object.keys(major_JSON)[0])
}}
/*
    deduplicate items in array
*/
function dedup(arr) {
    arr = arr.filter( function( item, index, inputArray ) {
           return inputArray.indexOf(item) == index;
    });
    return arr
}

var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var mongoClient = require('mongodb').MongoClient

var db;
var dbAddr = "mongodb://pi:comp420@ds139979.mlab.com:39979/comp420mongodb";
var coursesDb;

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json())
app.use(express.static(__dirname + '/public'))

app.set('port', (process.env.PORT || 3000))

/*
    specify that view engine is ejs
    now can use render
*/
app.set('view engine', 'ejs');


/*
    construct a list of all courses and deduplicate
*/
var allCourses = []
wesmap_JSON.forEach(function(dep, index) {
    allCourses = allCourses.concat(wesmap_JSON[index][Object.keys(dep)[0]])
})
/*
    use this variable to access all courses of all departments, no duplicates
    i.e. dedup_allCourses = [...,'Drawing I',...'Computer Science I',...]
*/
var dedup_allCourses = dedup(allCourses);

mongoClient.connect(dbAddr, (err, database) => {
    /*
        get the database
        only start the server once we have our database
    */
    if (err) return console.log(err)
    db = database
    coursesDb = db.collection('cardinalCourse');
    app.listen(app.get('port'), function() {
        console.log("listening on port " + app.get('port'))
    });
    
    /*
        if collection is empty,
        initialize entries for 939 courses in database
        each course has index as id, empty array for empty reviews
    */
    coursesDb.count(function (err, count) {
        if (!err && count === 0) {
            dedup_allCourses.forEach(function(course, index) {
                coursesDb.save({
                    name: course,
                    id: index,
                    rating: {stars: 0,
                             totalVote: 0},
                    reviews : []
                            /*[{postBy: "pi",
                                prof: "Prof. Awesome",
                                review: "great class",
                                sem: "spring 2017",
                                grade: "A",
                                rating: 0
                               },
                               {postBy: "cookie monster",
                                prof: "Prof. summer",
                                review: "meh",
                                sem: "Spring 2017",
                                grade: "A"}]*/
                })
            })
        }
    });
    
})

/*
    render homepage
*/
app.get('/', function(req,res) {
    res.render('index.ejs')
})

/*
    handle search query
    now allow only full course name
*/
app.get('/search', function(req,res) {
    console.log("Got a query!", req.query.searchQuery);

    var courseList = wesmap_JSON.map((dep,i,arr) => {
        return dep[`${Object.keys(dep)[0]}`].filter((course,index,arr1) => {
            return `${Object.keys(dep)[0]}`.toLowerCase().search(req.query.searchQuery.toLowerCase()) !== -1;
        });
    });


    var courseFound = [];

    courseList.forEach((lst) => {
        lst.forEach((courseName) => {
            courseFound.push(courseName);
        });
    });

    courseFound = courseFound.filter((lst) => {
        return lst !== [];
    });

    var searchResult = courseFound //=== [] ? courseFound : wesmap_JSON
    /*
        find course in database
    */
    var cursor = db.collection('cardinalCourse').find({name: {
        $in: courseFound
    }}).toArray(function (err, result) {
        if (err) return console.log(err);
        res.json(result);
    })

})

/*
    handle request to add review to database
*/
app.put('/add', (req,res) => {
    /*
        add review to existing list of reviews
    */
    db.collection('cardinalCourse').findOneAndUpdate(
        {name: req.body.name}, 
        {$push: {reviews: {postBy: req.body.postBy,
                           prof: req.body.prof,
                           review: req.body.review,
                           sem: req.body.sem,
                           grade: req.body.grade,
                           vote: 0}}
        },
        {sort: {_id: -1},
         upsert: true}, //update if found, insert if not found
        (err, result) =>
        {
            if (err) return res.send(err);
            res.send(result);
        })
})

/*
    handle request to update ratings
*/
app.put('/rate', (req,res) => {
    db.collection('cardinalCourse').findOneAndUpdate(
        {name: req.body.name},
        {$inc: {
            "rating.stars": Number(req.body.stars),
            "rating.totalVote": 1
        }},
        {returnOriginal : false}, //return the updated document
        (err, result) =>
        {
            res.send(result);
        })
})

/*
    handle request to upvote/downvote a review
*/
app.put('/upvote', (req,res) => {
    var i = req.body.index
    var key = 'reviews.' + i +'.vote'
    var obj = {}
    obj[key] = 1
    console.log(req.body)
    db.collection('cardinalCourse').findOneAndUpdate(
        {name: req.body.name},
        {$inc: obj
        },
        {returnOriginal : false, //return the updated document
         upsert: false}, 
        (err, result) =>
        {
            console.log(result)
            res.send(result);
        })
})

app.put('/downvote', (req,res) => {
    var i = req.body.index
    var key = 'reviews.' + i +'.vote'
    var obj = {}
    obj[key] = -1
    console.log(req.body)
    db.collection('cardinalCourse').findOneAndUpdate(
        {name: req.body.name},
        {$inc: obj
        },
        {returnOriginal : false, //return the updated document
         upsert: false}, 
        (err, result) =>
        {
            console.log(result)
            res.send(result);
        })
})
