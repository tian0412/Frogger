// open  dist/index.html  to play the game 


import "./style.css"; 
import { fromEvent, interval, merge } from "rxjs";
import { map, filter, scan, reduce } from "rxjs/operators";
import { ExternalsPlugin, HotUpdateChunk } from "webpack";


function main() {
  /**
   * Inside this function you will use the classes and functions from rx.js
   * to add visuals to the svg element in pong.html, animate them, and make them interactive.
   *
   * Study and complete the tasks in observable examples first to get ideas.
   *
   * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
   *
   * You will be marked on your functional programming style
   * as well as the functionality that you implement.
   *
   * Document your code!
   */
  
  const Constant = {
    Zero: 0,
    EachGroundMove: 8,
    EachWaterMove: 32,   
    EachMoveScore: 10,
    DistinctScore: 200,
    CanvasWidth: 532, 
    CanvasHeight: 500,
    FrogStartX: 251,     
    FrogStartY: 438,    
    FrogWidth: 30,        
    FrogHeight: 30,     

    GroundStartY: 286, 
    GroundEndY: 454,
    WaterStartY: 70,   
    WaterEndY: 240,  
    SafeZoneStartY: 228,   
    SafeZoneEndY: 268,

    DistinctY: 60,
    WinStartX1: 10,   
    WinEndX1: 58,

    WinStartX2: 120,
    WinEndX2: 152,

    WinStartX3: 225,
    WinEndX3: 263,

    WinStartX4: 335,
    WinEndX4: 368,

    WinStartX5: 440,
    WinEndX5: 478,
    

    StartSlowCarsCount: 2,
    SlowCarSpeed: -0.7,
    SlowCarStartX: 420,   
    SlowCarStartY: 390,  
    
    StartFastCarsCount: 1,
    FastCarSpeed: 2.5,
    FastCarStartX:7,      
    FastCarStartY:330,    
   
    StartLorriesCount: 2,
    LorrySpeed: 0.3,   
    LorryStartX: 460,    
    LorryStartY: 275,  

    VehicleSpacing: 60,
    VehicleWidth: 60,    
    VehicleHeight: 42,   
    LorryWidth: 80,
    LorryHeight: 55,

    StartTurtleCount: 3,  
    TurtleStartX: 430,
    TurtleStartY: 198,
    TurtleSpeed: -0.5,
    TurtleSpacing: 160,
    TurtleWidth: 80,     
    TurtleHeight: 45,    

    StartLotusCount: 10,    
    LotusSpeed:0.3,
    LotusStartX: 70,    
    LotusStartY: 107,   
    LotusSpacing: 95,   
    LotusWidth: 35,  
    LotusHeight: 35, 

    StartShortLogsCount: 4,   
    ShortLogSpeed: 0.3,
    ShortLogStartX: -10,   
    ShortLogStartY: 160,  
    ShortLogSpacing: 140,  
    ShortLogWidth: 90,

    StartMiddleLogsCount: 3,     
    MiddleLogSpeed: 0.5,
    MiddleLogStartX: 50,       
    MiddleLogStartY: 67,   
    MiddleLogSpacing: 170,  
    MiddleLogWidth: 130,

    StartLongLogsCount: 2,     
    LongLogSpeed: 0.9, 
    LongLogStartX: 90,     
    LongLogStartY: 130,    
    LongLogSpacing: 240,
    LongLogWidth: 190,

    LogHeight: 60,
    StartTime: 0
  } as const 
  
  // wrapper
  class Tick { constructor(public readonly elapsed: number){} }
  class Move { constructor(public readonly x:number, public readonly groundY: number, public readonly waterY:number){} }
  class Restart { constructor(){} } 

  type Key = "ArrowLeft" | "ArrowRight" 
    | "ArrowUp" | "ArrowDown" | "KeyR";
  type Event = "keydown";
  type ViewType = "frog" | "slowCar" | "fastCar" | "lorry" | "turtle" | "lotus" | "shortLog" | "middleLog" | "longLog";
  
  const 
    gameClock = interval(100)
      .pipe(map((elapsed: number) => new Tick(elapsed))),
    
    keyObservable = <T> (e:Event, k:Key, result: ()=> T) => 
      fromEvent<KeyboardEvent>(document, e)
        .pipe(
          filter( ({code}) => code === k),
          filter( ({repeat}) => !repeat),
          map(result)),
    
    leftmove = keyObservable('keydown', 'ArrowLeft', ()=> new Move(-Constant.EachGroundMove, Constant.Zero, Constant.Zero)),
    rightmove = keyObservable('keydown', 'ArrowRight', ()=> new Move(Constant.EachGroundMove, Constant.Zero, Constant.Zero)),
    upmove = keyObservable('keydown', 'ArrowUp', ()=> new Move(Constant.Zero,-Constant.EachGroundMove, -Constant.EachWaterMove)),
    downmove = keyObservable('keydown', 'ArrowDown', ()=>new Move(Constant.Zero,Constant.EachGroundMove, Constant.EachWaterMove)),
    restart = keyObservable('keydown', 'KeyR', ()=> new Restart())

    type Obstacle = Readonly<{pos: Vec, img: string, height: number, width: number}>
    type ObjectId = Readonly<{id: String, createTime: number}>

    interface IBody extends Obstacle, ObjectId{
      viewType: string,
      speed: number,
    }

    // Every object that participates in physics is a Body
    type Body = Readonly<IBody>

    // Game state - anything in your game that can be changed 
    type State = Readonly<{
      frog: Body,
      cars: ReadonlyArray<Body>,
      floats: ReadonlyArray<Body>,    // objects in the water
      score: number,
      highscore: number,
      winCount: number,             // use to increase game difficulty after 5 wins 
      win: boolean,
      gameTime: number,
      gameEnds: boolean,
      isRestart: boolean
    }>

    // wrap a position around edges of the screen 
    const 
      torusWrap = ({x, y}: Vec) => {
        const wrap = (v:number) => 
          v < 0? v + Constant.CanvasWidth: v > Constant.CanvasWidth ? v - Constant.CanvasWidth: v;
        return new Vec(wrap(x),y);
      }; 

    const createObject = (viewType: ViewType) => (oid: ObjectId) => (obj: Obstacle) => (speed: number) => 
      <Body> {
        ...oid,
        ...obj,
        pos: torusWrap(new Vec(obj.pos.x + speed, obj.pos.y)),
        speed: speed,
        width: obj.width,
        height: obj.height,
        id: viewType+ oid.id,
        viewType: viewType
      }, 
      createSlowCar = createObject('slowCar'),
      createFastCar = createObject('fastCar'),
      createLorry = createObject('lorry'),
      createTurtle = createObject('turtle'),
      createLotus = createObject('lotus'),
      createShortLog = createObject('shortLog'),
      createMiddleLog = createObject('middleLog'),
      createLongLog = createObject('longLog')
    
    // create frog
    function createFrog():Body{
      return{
        id: 'frog',
        viewType: 'frog',
        pos: new Vec(Constant.FrogStartX, Constant.FrogStartY),
        width: Constant.FrogWidth,
        height: Constant.FrogHeight,
        img: "../assets/froggerUp.png",
        speed: Constant.Zero,
        createTime: Constant.StartTime
      }
    }
    
    const 
      startSlowCar = [...Array(Constant.StartSlowCarsCount)]
        .map((_,i) => createSlowCar({id: String(i), createTime: Constant.StartTime})
                                   ({pos: torusWrap(new Vec(Constant.SlowCarStartX + (i*Constant.VehicleSpacing), Constant.SlowCarStartY)), img: "../assets/slow-car.png", width: Constant.VehicleWidth,height: Constant.VehicleHeight})
                                   (Constant.SlowCarSpeed)),
                                   
      startFastCar = [...Array(Constant.StartFastCarsCount)]
        .map((_,i) => createFastCar({id: String(i), createTime: Constant.StartTime})
                                   ({pos: torusWrap(new Vec(Constant.FastCarStartX + (i*Constant.VehicleSpacing), Constant.FastCarStartY)), img:"../assets/fast-car.png", width: Constant.VehicleWidth,height: Constant.VehicleHeight})
                                   (Constant.FastCarSpeed)),
      
      startLorry = [...Array(Constant.StartLorriesCount)]
        .map((_,i) => createLorry({id: String(i), createTime: Constant.StartTime})
                                 ({pos: torusWrap(new Vec(Constant.LorryStartX + (i*Constant.VehicleSpacing), Constant.LorryStartY)), img:"../assets/lorry.png", width: Constant.LorryWidth, height: Constant.LorryHeight})
                                 (Constant.LorrySpeed)),   
      
      startTurtle = [...Array(Constant.StartTurtleCount)]   
        .map((_,i) => createTurtle({id: String(i), createTime:Constant.StartTime})
                                  ({pos: torusWrap(new Vec(Constant.TurtleStartX + (i*Constant.TurtleSpacing), Constant.TurtleStartY)), img: "../assets/turtles.png", width: Constant.TurtleWidth, height:Constant.TurtleHeight})
                                  (Constant.TurtleSpeed)),

      startLotus = [...Array(Constant.StartLotusCount)]
        .map((_,i) => createLotus({id: String(i), createTime: Constant.StartTime})
                                 ({pos: torusWrap(new Vec(Constant.LotusStartX + (i*Constant.LotusSpacing), Constant.LotusStartY)), img: "../assets/lotus.png", width: Constant.LorryWidth, height: Constant.LotusHeight})
                                 (Constant.LotusSpeed)),                                 
      
      startShortPlank = [...Array(Constant.StartShortLogsCount)]
        .map((_,i) => createShortLog({id: String(i), createTime: Constant.StartTime}) 
                                    ({pos: torusWrap(new Vec(Constant.ShortLogStartX + (i*Constant.ShortLogSpacing), Constant.ShortLogStartY)), img: "../assets/short-log.png", width:Constant.ShortLogWidth, height: Constant.LogHeight})
                                    (Constant.ShortLogSpeed)),
      
      startMiddlePlank = [...Array(Constant.StartMiddleLogsCount)]
        .map((_,i) => createMiddleLog({id: String(i), createTime: Constant.StartTime}) 
                                    ({pos: torusWrap(new Vec(Constant.MiddleLogStartX + (i*Constant.MiddleLogSpacing), Constant.MiddleLogStartY)), img: "../assets/middle-log.png", width:Constant.MiddleLogWidth, height: Constant.LogHeight})
                                    (Constant.MiddleLogSpeed)),

      startLongPlank = [...Array(Constant.StartLongLogsCount)]
        .map((_,i) => createLongLog({id: String(i), createTime: Constant.StartTime}) 
                                    ({pos: torusWrap(new Vec(Constant.LongLogStartX + (i*Constant.LongLogSpacing), Constant.LongLogStartY)), img: "../assets/long-log.png", width:Constant.LongLogWidth, height: Constant.LogHeight})
                                    (Constant.LongLogSpeed)),                                                      
                             
      // create initial state 
      initialState: State ={
        frog: createFrog(),
        cars: startSlowCar.concat(startFastCar, startLorry),
        floats: startTurtle.concat(startLotus, startShortPlank, startMiddlePlank, startLongPlank),
        score: Constant.Zero,
        highscore: Constant.Zero,
        winCount: Constant.Zero,
        win: false,
        gameTime: Constant.StartTime,
        gameEnds: false,
        isRestart: false  
      },

      moveBody = (o: Body) => <Body> {
        ...o, 
        pos: torusWrap(new Vec(o.pos.x + o.speed, o.pos.y))
      },

      increaseDifficulty = (o: Body) => <Body> {
        ...o,
        speed: o.speed < 0? o.speed - 0.5 : o.speed + 0.5
      },

      decreaseSize = (o:Body) => <Body> {
        ...o,
        width: o.width - 50,
        height: o.height - 50
      },

      increaseSize = (o: Body) => <Body> {
        ...o,
        width: o.width + 50,
        height: o.height + 50 
      },

      handleCollisions = (s:State) => {
        const
          // Notes: reason fro /2 for frog's height and width when checking is mainly because the car image contains some 'black' region 
          //        which is same as its background colour 
          groundCollided = (b:Body) =>     
            (within(b.pos.y, b.pos.y + b.height /2, s.frog.pos.y)     // frog's top overlaps obj's bottom 
              &&(within(b.pos.x, b.pos.x + b.width /2, s.frog.pos.x + s.frog.width/2)   // frog's top overlaps obj's bottom left
                || within(b.pos.x, b.pos.x + b.width, s.frog.pos.x +s.frog.width/2 ))   // frog's top overlaps obj's bottom right
            || (within(b.pos.y, b.pos.y + b.width /2, s.frog.pos.y + s.frog.height /2)  // frog's bottom overlaps obj's top
              && (within(b.pos.x, b.pos.x + b.width /2, s.frog.pos.x + s.frog.width/2)  // frog's bottom right overlaps obj's top left
                || within(b.pos.x, b.pos.x + b.width, s.frog.pos.x +s.frog.width/2)))), // frog's bottom left overlaps obj's top right
          groundEnd = within(Constant.GroundStartY, Constant.GroundEndY, s.frog.pos.y)  // in ground area 
            && s.cars.filter(c => groundCollided(c)).length > 0,                        // && collides 
              
          waterArea =  within(Constant.WaterStartY, Constant.WaterEndY, s.frog.pos.y)   // in water area 
            && !within(Constant.SafeZoneStartY, Constant.SafeZoneEndY, s.frog.pos.y),   // && not in safe zone 
          
          onFloat = (b:Body) =>                                         // check if all frog's top, left, bottom and right sides overlaps the float 
            (within(b.pos.y, b.pos.y + b.height,  s.frog.pos.y)         // top 
              && within(b.pos.x, b.pos.x + b.width, s.frog.pos.x)       // left  
              && within(b.pos.y, b.pos.y + b.height, s.frog.pos.y + s.frog.height)   // bottom  
              && within(b.pos.x, b.pos.x + b.width, s.frog.pos.x + s.frog.width)),   // right   
          
          floating = waterArea && s.floats.filter(f=> onFloat(f)).length > 0,
          currentFloat = s.floats.filter(f=> onFloat(f))[0],
          drown = waterArea && s.floats.filter(f=> onFloat(f)).length === 0
    
        return <State> {
          ...s,
          frog: {...s.frog,
            speed: floating? currentFloat.speed: Constant.Zero
          },
          highscore: s.score > s.highscore? s.score: s.highscore,
          gameEnds: groundEnd || drown
        }
      },

      tick = (s:State, elapsed: number) => {
        return handleCollisions({...s,
          frog: s.win? {...s.frog, pos: new Vec(Constant.FrogStartX, Constant.FrogStartY)}
            : moveBody(s.frog),
          cars: s.winCount === 5? s.cars.map(increaseDifficulty).map(moveBody)
            : s.cars.map(moveBody),
          floats: s.winCount === 5? s.floats.map(increaseDifficulty).map(moveBody)
            : s.floats.map(moveBody),      
          win: s.win? false: s.win,
          winCount: s.winCount === 1? 0: s.winCount,
          gameTime: elapsed,
        })
      },
      
      // check if frog reaches one of the distinct target area 
      isWin = (frogX: number, frogY:number):boolean => {
        return frogY <= Constant.DistinctY 
          && (within(Constant.WinStartX1, Constant.WinEndX1, frogX)
          || within(Constant.WinStartX2, Constant.WinEndX2, frogX)
          || within(Constant.WinStartX3, Constant.WinEndX3, frogX)
          || within(Constant.WinStartX4, Constant.WinEndX4, frogX)
          || within(Constant.WinStartX5, Constant.WinEndX5, frogX))
      }
    
    // state transducer 
    const 
        reduceState = (s: State, e: Move | Tick | Restart): State => 
        e instanceof Move? {
          ...s,
          frog: {...s.frog, 
            pos: within(Constant.WaterStartY, Constant.WaterEndY, s.frog.pos.y)?    // Notes: one move in ground area is not the same as in water area 
              torusWrap(new Vec(s.frog.pos.x + e.x, s.frog.pos.y + e.waterY))
                : torusWrap(new Vec(s.frog.pos.x + e.x, s.frog.pos.y + e.groundY))
          },
          score: isWin(s.frog.pos.x, s.frog.pos.y + e.waterY)? s.score + Constant.DistinctScore
            : e.groundY < 0 || e.waterY < 0? s.score + Constant.EachMoveScore                  // only upmove get score
              : s.score,   
          win: isWin(s.frog.pos.x, s.frog.pos.y + e.waterY),
          winCount: isWin(s.frog.pos.x, s.frog.pos.y + e.waterY)? s.winCount + 1: s.winCount
        }
        : e instanceof Restart? {...s,
          frog: createFrog(),
          cars: startSlowCar.concat(startFastCar, startLorry),
          floats: startTurtle.concat(startLotus, startShortPlank, startMiddlePlank, startLongPlank),
          highscore: s.highscore > s.score? s.highscore: s.score,
          score: Constant.Zero,
          winCount: Constant.Zero,
          gameTime: Constant.StartTime,
          gameEnds: false,
          isRestart: true
        }
        :
        tick({...s, isRestart: false, gameEnds: false}, e.elapsed)
    
    //main game stream 
    const subscription = 
      merge(gameClock, 
        leftmove, rightmove, upmove, downmove, restart)
      .pipe(
        scan(reduceState, initialState),
      ).subscribe(updateView);
     

  /**
   * This is the view for your game to add and update your game elements.
   */

  function updateView(state:State){
    const 
      svg = document.getElementById("svgCanvas")!,
      background = document.getElementById("background")!,
      show = (id: string, condition: boolean) => ((e:HTMLElement) => 
            condition? (e.classList.remove('hidden')):
             state.winCount === 5 && (e.classList.add('hidden')))(document.getElementById(id)!),
      hscore = document.getElementById("highscore")!,
      score = document.getElementById("score")!,
      text = document.getElementById("gameEnd")!;
      
      // update / generate cars 
      state.cars.forEach((carState: Body) => {
        const car = document.getElementById(String(carState.id))
        if (car == null) {
          const newCar = document.createElementNS(svg.namespaceURI, "image");
          newCar.setAttribute("id", String(carState.id));
          newCar.setAttribute("href", String(carState.img));
          newCar.setAttribute("width", String(carState.width));
          newCar.setAttribute("height", String(carState.height));
          newCar.setAttribute("x", String(carState.pos.x));
          newCar.setAttribute("y", String(carState.pos.y));
          svg.appendChild(newCar);
        } else{
          car.setAttribute("x", String(carState.pos.x));
          car.setAttribute("y", String(carState.pos.y));
        }
      })

      // update / generate floats 
      state.floats.forEach((floatState: Body) => {
        const float = document.getElementById(String(floatState.id))
        if (float == null) {
          const newFloat = document.createElementNS(svg.namespaceURI, "image");
          newFloat.setAttribute("id", String(floatState.id));
          newFloat.setAttribute("href", String(floatState.img));
          newFloat.setAttribute("width", String(floatState.width));
          newFloat.setAttribute("height", String(floatState.height));
          newFloat.setAttribute("x", String(floatState.pos.x));
          newFloat.setAttribute("y", String(floatState.pos.y));
          svg.appendChild(newFloat);
        } else{
          float.setAttribute("x", String(floatState.pos.x));
          float.setAttribute("y", String(floatState.pos.y));
        }
      })    
    
    // create / update player
    const player = document.getElementById(String(state.frog.id));
    if (player == null) {
      const newPlayer = document.createElementNS(svg.namespaceURI, "image");
      newPlayer.setAttribute("id", String(state.frog.id));
      newPlayer.setAttribute("href", String(state.frog.img));
      newPlayer.setAttribute("width", String(state.frog.width));
      newPlayer.setAttribute("height", String(state.frog.height));
      newPlayer.setAttribute("x", String(state.frog.pos.x));
      newPlayer.setAttribute("y", String(state.frog.pos.y));
      svg.appendChild(newPlayer);
    } else{
      player.setAttribute("x", String(state.frog.pos.x));
      player.setAttribute("y", String(state.frog.pos.y));
    }
    
    if (state.win || state.win && state.winCount === 4){
      const 
        reachAndShow = (state.frog.pos.y <= Constant.DistinctY) && state.winCount <= 4,
        frogX = state.frog.pos.x
      show("frogEnd1", reachAndShow && within(Constant.WinStartX1, Constant.WinEndX1, frogX));
      show("frogEnd2", reachAndShow && within(Constant.WinStartX2, Constant.WinEndX2, frogX));
      show("frogEnd3", reachAndShow && within(Constant.WinStartX3, Constant.WinEndX3, frogX));
      show("frogEnd4", reachAndShow && within(Constant.WinStartX4, Constant.WinEndX4, frogX));
      show("frogEnd5", reachAndShow && within(Constant.WinStartX5, Constant.WinEndX5, frogX));
    }
   
    if (state.gameEnds){
      subscription.unsubscribe();
      text.classList.remove("hidden")
      restart
        .pipe(
          scan(reduceState, initialState)
        )
        .subscribe(updateView)
     }
    
    if (state.isRestart){
      text.classList.add("hidden")
      merge( gameClock, 
        leftmove, rightmove, upmove, downmove, restart)
      .pipe(
        scan(reduceState, initialState),
      ).subscribe(updateView);
    }
    hscore.textContent = `HighScore: ${state.highscore}`;
    score.textContent = `Score: ${state.score}`;
  }
}

/**
 * A simple immutable vector class 
 */
class Vec {
  constructor(public readonly x: number = 0, public readonly y: number = 0){}
  add = (b: Vec) => new Vec(this.x + b.x, this.y + b.y) 
    
  static Zero = new Vec();
}

const 
  within = (start: number, end: number, compare: number) => 
    compare >= start && compare <= end? true: false

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
