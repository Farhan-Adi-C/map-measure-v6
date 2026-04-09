let wrapper = document.getElementById("map-wrapper")
let container = document.getElementById("zoom-container")
let svg = document.getElementById("indonesia-map")

let markerLayer = document.createElement("div")
markerLayer.id = `marker-layer`
markerLayer.style.cssText = `
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
`

let lineLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
lineLayer.id = `line-layer`;
lineLayer.style.cssText = `
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
`

container.append(markerLayer);

container.insertBefore(lineLayer, markerLayer);

let scale = 1;
let pointX = 0;
let pointY = 0;

let minScale = 1;
let maxScale = 5;

let startClick;
let isPanning = false;

let nextId = 1;
let points = [];

let tempClick;

let connectSourceId;
let tempConnections;

let transportMode = {
    train: { color: "#33E339", speed: 120, cost: 500, label: "Train", offset: 0 },
    bus: { color: "#A83BE8", speed: 80, cost: 100, label: "Bus", offset: 1.2 },
    plane: { color: "#000000", speed: 800, cost: 1000, label: "Plane", offset: -1.2 }
}

let lineGClick = null;

function updateContainer() {
    container.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`
}

function limitContainer() {
    let wrapperW = wrapper.clientWidth, wrapperH = wrapper.clientHeight;
    let containerW = container.scrollWidth, containerH = container.scrollHeight;

    let minX = wrapperW - containerW * scale;
    let minY = wrapperH - containerH * scale;
    let maxX = 0, maxY = 0;

    pointX = Math.min(maxX, Math.max(minX, pointX));
    pointY = Math.min(maxY, Math.max(minY, pointY))
}

function zoomAt(x, y, zoomFactor) {
    let newScale = Math.min(maxScale, Math.max(minScale, scale * zoomFactor))

    let jarakX = (x - pointX) / scale;
    let jarakY = (y - pointY) / scale;

    pointX = x - jarakX * newScale;
    pointY = y - jarakY * newScale;

    scale = newScale;
    limitContainer()
    updateContainer()
}

container.addEventListener("wheel", (e) => {
    if (!e.ctrlKey) return;

    e.preventDefault();

    zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? .9 : 1.1);
})

document.addEventListener("keydown", (e) => {

    if (e.key == "Backspace" || e.key == "Delete") {
        deleteLine()
    }


    if (!e.ctrlKey) return;

    let rect = container.getBoundingClientRect();
    if (e.key == "+" || e.key == "=") {
        zoomAt(container.scrollWidth / 2, container.scrollHeight / 2, 1.1);
    }
    if (e.key == "-") {
        zoomAt(container.scrollWidth / 2, container.scrollHeight / 2, .9);
    }
})

container.addEventListener("click", () => {
    if (lineGClick !== null) {
        lineGClick.querySelector("line").setAttribute("stroke-width", "2");
        lineGClick = null;
    }
})

container.addEventListener("mousedown", (e) => {
    isPanning = true;
    startClick = {
        x: e.clientX - pointX,
        y: e.clientY - pointY
    }
})

container.addEventListener("mouseup", () => {
    isPanning = false
})

container.addEventListener("mousemove", (e) => {
    if (!isPanning) return;

    pointX = e.clientX - startClick.x;
    pointY = e.clientY - startClick.y;

    limitContainer()
    updateContainer()
})

let modalKota = document.getElementById("modal-kota")
let inputKota = document.getElementById("inputKota")
let closeKota = document.getElementById("closeKota")
let submitKota = document.getElementById("submitKota")

closeKota.onclick = () => {
    closeModalKota()
}


container.addEventListener("dblclick", (e) => {
    let rect = container.getBoundingClientRect();
    tempClick = {
        x: (e.clientX - rect.left) / rect.width * 100,
        y: (e.clientY - rect.top) / rect.height * 100
    }
    showModalKota()
 

})

function closeModalKota() {
    inputKota.value = ""
    modalKota.style.display = "none"
    tempClick = null;
}

function showModalKota() {
    modalKota.style.display = "flex"
    inputKota.focus();
}

submitKota.onclick = () => {
    submitModalKota();
}

function submitModalKota() {
    if (inputKota.value == "" || !inputKota.value.trim()) {
        inputKota.focus();
        return
    }

    addMarker(tempClick.x, tempClick.y, inputKota.value);
    saveToStorage();
    closeModalKota();

}

function addMarker(percentX, percentY, name, otherId = null) {
    let id = otherId ? Number(otherId) : nextId++
    if (otherId && otherId >= nextId) nextId = otherId + 1;

    let el = document.createElement("div");
    el.id = `marker-${id}`
    el.style.cssText = `
        position: absolute;
        display: flex;
        flex-direction: column;
        align-items: center;
        z-index: 100;
        transform: translate(-50%, -100%);
        left: ${percentX}%;
        top: ${percentY}%;
        pointer-events: all;
    `

    el.innerHTML = `
    <div style="padding: 4px; border-radius: 10px; display: flex; gap: 5px; background-color: white; border: 1px solid #000; font-weight: 700; align-items: center; whitespace: no-wrap;">
        <span>${name}</span>
        <div style="width: 1px; height: 14px; background-color: black;"></div>
        <button class="btn-connect" style="background-color: white; border: none;">🔗</button>
        <div style="width: 1px; height: 14px; background-color: black;"></div>
        <button class="btn-delete" style="width: 25px; height: 25px; border-radius: 50%; color: white; background-color: red; border: none;">X</button>
    </div>
    <img src="./location3.png" alt="" style="width: 30px; height: auto; pointer-events: none; ">
    `

    let point = { id, x: percentX, y: percentY, name, connections: [] };
    points.push(point)

    markerLayer.append(el);

    el.querySelector(".btn-connect").addEventListener("click", (e) => {
        if (connectSourceId && connectSourceId !== id) finishConnect(id);
        else {
            startConnect(id)
        }
    })

    el.querySelector(".btn-delete").addEventListener("click", () => {
        deleteMarker(id);
    })

    return point;
}

let modalConnections = document.getElementById("modal-connection");
let inputDistance = document.getElementById("inputDistance");
let inputMode = document.getElementById("inputMode");
let submitConnection = document.getElementById("submitConnection");
let closeConnection = document.getElementById("closeConnection")

closeConnection.onclick = () => {
    cancelConnect();
}

function startConnect(sourceId) {
    if (connectSourceId == sourceId) {
        cancelConnect()
        return;
    }

    connectSourceId = sourceId;
    markerLayer.querySelector(`#marker-${sourceId}`).style.filter = "drop-shadow(0 0 8px rgb(197, 85, 197))";

}

function finishConnect(targetId) {
    let source = points.find(p => p.id == connectSourceId);
    let target = points.find(p => p.id == targetId);

    if (!source && !target) {
        cancelConnect();
        return;
    }

    tempConnections = { source, target }
    showModalConnect();
}

function cancelConnect() {
    if (connectSourceId) {
        let el = markerLayer.querySelector(`#marker-${connectSourceId}`);
        if (el) {
            el.style.filter = "";
        }
    }

    connectSourceId = null;
    modalConnections.style.display = "none";
    inputDistance.value = ""
}

function showModalConnect() {
    modalConnections.style.display = "flex"
    inputDistance.focus();
}

submitConnection.onclick = () => {
    if (inputDistance.value == "" || !inputDistance.value.trim()) {
        cancelConnect();
        return;
    }

    let { source, target } = tempConnections;

    let conn = source.connections.find(c => c.to == target.id);

    if (conn && conn.mode == inputMode.value) {
        alert("Jalur dengan mode yang sama sudah ada")
        cancelConnect();
        return;
    }

    let mode = transportMode[inputMode.value.trim()];

    source.connections.push({ to: target.id, mode: inputMode.value, distance: inputDistance.value.trim(), color: mode.color, cost: mode.cost, speed: mode.speed });
    target.connections.push({ to: source.id, mode: inputMode.value, distance: inputDistance.value.trim(), color: mode.color, cost: mode.cost, speed: mode.speed });


    drawLine(tempConnections.source, tempConnections.target, inputDistance.value.trim(), inputMode.value);
    saveToStorage()
 
    cancelConnect();


}

function drawLine(source, target, distance, modeKey) {

    let mode = transportMode[modeKey];
    let connectKey = [source.id, target.id].sort().join("-") + "-" + modeKey;

    if (lineLayer.querySelector(`[data-key="${connectKey}"]`)) return;

    let jarakX = target.x - source.x;
    let jarakY = target.y - source.y;

    let rect = lineLayer.getBoundingClientRect();
    let aspectRatio = rect.width / rect.height;

    let xScreen = jarakX
    let yScreen = jarakY / aspectRatio;

    let len = Math.sqrt(xScreen * xScreen + yScreen * yScreen);


    let geserX = (-yScreen / len) * mode.offset;
    let geserY = (xScreen / len) * mode.offset;

    let g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("data-key", connectKey);
    g.style.pointerEvents = "all";

    let angle = Math.atan2(yScreen, xScreen) * (180 / Math.PI);

    let textAngle = angle;
    if (textAngle > 90 || textAngle < -90) textAngle += 180;


    let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", `${source.x + geserX}%`);
    line.setAttribute("y1", `${source.y + geserY}%`);
    line.setAttribute("x2", `${target.x + geserX}%`);
    line.setAttribute("y2", `${target.y + geserY}%`);
    line.setAttribute("stroke", mode.color);
    line.setAttribute("stroke-width", "2");
    line.style.cursor = "pointer";

    let midX = (source.x + target.x) / 2 + geserX;
    let midY = (source.y + target.y) / 2 + geserY;

    let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", `${midX}%`)
    text.setAttribute("y", `${midY}%`)
    text.setAttribute("font-size", "11")
    text.setAttribute("font-weight", "bold")
    text.setAttribute("fill", mode.color)
    text.style.transformOrigin = `${midX}% ${midY}%`;
    text.setAttribute("transform", `rotate(${textAngle})`);
    text.textContent = distance;

    line.addEventListener("click", (e) => {
        e.stopPropagation();
        lineGClick = g;
        line.setAttribute("stroke-width", "4");
    })

    g.append(line, text);
    lineLayer.append(g);

}

function deleteMarker(id) {
    points.forEach(p => {
        p.connections = p.connections.filter(c => c.to !== id);
    })

    lineLayer.querySelectorAll(`[data-key]`).forEach(line => {
        if (line.dataset.key.split("-").includes(String(id))) line.remove();
    })

    markerLayer.querySelector(`#marker-${id}`)?.remove();
    points = points.filter(p => p.id !== id);

    saveToStorage();
}

function deleteLine() {
    if (lineGClick) {
        let key = lineGClick.dataset.key.split("-");;
        let source = points.find(p => p.id == key[0]);
        let target = points.find(p => p.id == key[1]);
        let mode = key[2];

        source.connections = source.connections.filter(c => !(c.to == target.id && c.mode == mode));
        target.connections = target.connections.filter(c => !(c.to == source.id && c.mode == mode));

        lineGClick.remove();
        lineGClick = null;

        saveToStorage()
    }
}

let modalRoute = document.getElementById("find-route-modal");
let inputFrom = document.getElementById("inputFrom")
let inputTo = document.getElementById("inputTo");
let buttonSearch = document.getElementById("buttonSearch")
let buttonFastest = document.getElementById("buttonFastest")
let buttonCheapest = document.getElementById("buttonCheapest")
let routeContent = document.getElementById("route-content");

let sortMode = "fastest";

inputFrom.addEventListener("input", validateInput)
inputTo.addEventListener("input", validateInput)

buttonCheapest.onclick = () => {
    sortMode = "cheapest"

    buttonCheapest.style.cssText = `
        color: blue;
        text-decoration: underline;
        margin-right: 10px;
        cursor: pointer;
        `;
    buttonFastest.style.cssText = `
        color: gray;
        text-decoration: none;
        margin-right: 10px;
        cursor: pointer;
        `

    doSearch();
}

buttonFastest.onclick = () => {
     sortMode = "fastest"

    buttonCheapest.style.cssText = `
        color: gray;
        text-decoration: none;
        margin-right: 10px;
        cursor: pointer;
        `;
    buttonFastest.style.cssText = `
        color: blue;
        text-decoration: underline;
        margin-right: 10px;
        cursor: pointer;
        `

    doSearch();
}

function getPointByName(name) {
    return points.find(p => p.name == name) || null;
}

function validateInput() {
    let fromVal = getPointByName(inputFrom.value.trim());
    let toVal = getPointByName(inputTo.value.trim());

    inputFrom.style.border = fromVal ? "1px solid rgb(101, 224, 70)" : "1px solid red"
    inputTo.style.border = toVal ? "1px solid rgb(101, 224, 70)" : "1px solid red"

    buttonSearch.style.backgroundColor = (fromVal && toVal) ? "rgb(53, 147, 235)" : "rgb(98, 136, 172)";
    buttonSearch.disabled = !(fromVal && toVal)
    buttonSearch.style.cursor = (fromVal && toVal) ? "pointer" : "not-allowed"
}

buttonSearch.addEventListener("click", () => {
    doSearch();
})

function doSearch() {
    let source = getPointByName(inputFrom.value.trim());
    let target = getPointByName(inputTo.value.trim());

    console.log(sortMode);
    
    if(!source || !target) return;

    let routes = getAllRoutes(source.id, target.id);

console.log(routes);

    routes.sort((a, b) => {
        let totalA = getTotal(a.edges), totalB = getTotal(b.edges);
        return sortMode == "fastest" ?
            totalA.totalDuration - totalB.totalDuration :
            totalA.totalCost - totalB.totalCost;
 
    })

    renderRoutes(routes);
}

function getAllRoutes(sourceId, targetId) {
    sourceId = Number(sourceId)
    targetId = Number(targetId)

    let results = [];
    let queue = [{ path: [sourceId], edges: [] }];
    let iterations = 1;

    while (queue.length > 0 && iterations++ < 2000) {
        let { path, edges } = queue.shift();
        let current = path[path.length - 1];

        if (current == targetId) {
            results.push({ path, edges });
            if (results.length > 10) break;
            continue;
        }

        let pointCurrent = points.find(p => p.id == current);
        if (!pointCurrent) continue;

        for (let conn of pointCurrent.connections) {
            if (path.includes(conn.to)) continue;

            let mode = transportMode[conn.mode]

            queue.push({
                path: [...path, conn.to],
                edges: [...edges, {
                    from: current,
                    to: conn.to,
                    mode: conn.mode,
                    distance: conn.distance,
                    cost: Number(conn.distance) * mode.cost,
                    duration: (Number(conn.distance) / mode.speed)
                }]
            })
        }
    }

    return results
}

function getTotal(edges) {
    let totalCost = 0;
    let totalDuration = 0;
    for (let edge of edges) {
        totalCost += Number(edge.cost);
        totalDuration += Number(edge.duration)
    }
console.log(totalDuration);

    return { totalCost, totalDuration };
}

function renderRoutes(routes) {
    if (!routes || routes.length <= 0) {
        routeContent.innerHTML = `<div style="color: gray; font-size: 13px">Route tidak ditemukan</div>`
    }

    routeContent.innerHTML = routes.map((route, i) => {
        let fromName = points.find(p => p.id == route.path[0])?.name || "";
        let toName = points.find(p => p.id == route.path[route.path.length - 1])?.name || "";
        let duration = 0;
        let cost = 0;

        let step = route.edges.map(edge => {
            let fn = points.find(p => p.id == edge.from)?.name || "";
            let tn = points.find(p => p.id == edge.to)?.name || "";
            duration += edge.duration;
            cost += edge.cost
            
            return `<li>${fn} - ${tn} ( ${edge.distance}km )</li>`
        }).join("")

        return `
         <div style=" padding: 10px; background-color: rgb(179, 179, 179); border-radius: 10px; margin-bottom: 5px;  ">
                <div style="display: flex; justify-content: space-between;"><span>${i + 1}. ${fromName} - ${toName}</span> <span>${duration.toFixed(1)}h</span></div>
                <ul>
                    ${step}
                </ul>
                Rp. ${Number(cost).toLocaleString()}
            </div>
        `
    }).join("")
}

function saveToStorage() {
    localStorage.setItem("data-points", JSON.stringify(points));
}

function loadFromStorage() {
    let data;
    try {
        data = JSON.parse(localStorage.getItem("data-points")) || []
    } catch (error) {
        return;
    }

    data.forEach(p => {
        let point = addMarker(p.x, p.y, p.name, p.id);
        point.connections = p.connections;
    })

    data.forEach(point => {
        (point.connections)?.forEach(conn => {
            let source = points.find(p => p.id == point.id);
            let target = points.find(p => p.id == conn.to);

            if (source && target) {

                drawLine(source, target, conn.distance, conn.mode);
            }
        })
    })
}

loadFromStorage()