﻿/**
 * 
 * NOTE:
 * This library will eventually be included in the minification.  
 * During development it is executed as native javascript.
 * When it is added to the minification build, remove the reference to this script from from index.html
 * 
 */


/**
 * A collection of CSET-specific utilities and functionality.
 */
CsetUtils = function ()
{

}


/**
 * If the edit is a cell being moved or added, makes it 'unconnectable'
 * if it is now the child of a multi-service component. 
 * @param {any} edit
 */
CsetUtils.adjustConnectability = function (edit)
{
    for (var i = 0; i < edit.changes.length; i++)
    {
        if (edit.changes[i] instanceof mxChildChange)
        {
            var c = edit.changes[i].child;

            if (c.isEdge())
            {
                return;
            }

            // zones are not connectable
            if (c.isZone())
            {
                c.setConnectable(false);
                return;
            }

            // children of an MSC are not connectable
            if (c.isParentMSC())
            {
                c.setConnectable(false);
            }
            else
            {
                c.setConnectable(true);
            }
        }
    }
}


/**
 * Persists the graph to the CSET API.
 */
CsetUtils.PersistGraphToCSET = function (editor)
{
    var jwt = localStorage.getItem('jwt');
    var enc = new mxCodec();
    var node = enc.encode(editor.graph.getModel());
    var oSerializer = new XMLSerializer();
    var sXML = oSerializer.serializeToString(node);

    var req = {};
    req.DiagramXml = sXML;
    req.LastUsedComponentNumber = sessionStorage.getItem("last.number");

    if (sXML == EditorUi.prototype.emptyDiagramXml)
    {
        // debugger;
    }



    // ---------------------------------------------------------------------------------------------------
    var selectionEmpty = editor.graph.isSelectionEmpty();
    var ignoreSelection = selectionEmpty;
    var bg = '#ffffff';

    var svgRoot = editor.graph.getSvg(bg, 1, 0, true, null, true, true, null, null, false);


    var c = document.createElement('canvas');
    canvg(c, new XMLSerializer().serializeToString(svgRoot));
    var img2 = c.toDataURL("image/png");
    req.DiagramSvg = img2;

    console.log(img2);



    // var svgXml = mxUtils.getXml(svgRoot, 'image/svg+xml');
    // req.DiagramSvg = svgXml;




    //var diagramDiv = document.getElementsByClassName("geDiagramContainer")[0];
    //var topG = diagramDiv.getElementsByTagName("svg")[0];

    //console.log(topG);


    // ---------------------------------------------------------------------------------------------------


    //img.onload = function ()
    //{
    //    console.log('image onload');

    //    //canvas.drawImage(img, 0, 0);
    //    //var img2 = canvas.toDataURL("image/png");
    //    //req.DiagramSvg = img2;


    //    //console.log('data url done');
    //    //console.log(req);


    //    //var url = localStorage.getItem('cset.host') + 'diagram/save';
    //    //var xhr = new XMLHttpRequest();
    //    //xhr.onreadystatechange = function ()
    //    //{
    //    //    if (this.readyState == 4 && this.status == 200)
    //    //    {
    //    //        // successful post            
    //    //    }
    //    //    if (this.readyState == 4 && this.status == 401)
    //    //    {
    //    //        window.location.replace('error401.html');
    //    //    }
    //    //}
    //    //xhr.open('POST', url);
    //    //xhr.setRequestHeader('Content-Type', 'application/json');
    //    //xhr.setRequestHeader('Authorization', jwt);
    //    //xhr.send(JSON.stringify(req));
    //}


    // var svgString = new XMLSerializer().serializeToString(document.querySelector('svg'));
    var svgString = new XMLSerializer().serializeToString(svgRoot);

    //var canvas = document.getElementById("canvas");
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");
    var DOMURL = self.URL || self.webkitURL || self;
    var img = new Image();
    var svg = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });

    console.log(svg);

    var url = DOMURL.createObjectURL(svg);
    img.onload = function ()
    {
        ctx.drawImage(img, 0, 0);
        var png = canvas.toDataURL("image/png");
        console.log(png);
        document.querySelector('#png-container').innerHTML = '<img src="' + png + '"/>';
        DOMURL.revokeObjectURL(png);
    };
    img.src = url;



    //console.log('about to set source');

    //var xml = new XMLSerializer().serializeToString(svgRoot);
    //console.log(xml);

    //var img = new Image();
    //console.log('image onload');
    //img.src = "data:image/svg+xml;charset=utf-8," + xml;

    //setTimeout(function ()
    //{

    //    console.log(img);

    //    var canvas = document.createElement("canvas");
    //    var ctx = canvas.getContext("2d");
    //    ctx.drawImage(img, 0, 0);
    //    var u = canvas.toDataURL("image/png");
    //    req.DiagramSvg = u;

    //    console.log(req.DiagramSvg);
    //}, 5000);
    



   

}



/**
 * Sends the file content to the CSET API for translation into an mxGraph diagram and drops it
 * into the existing diagram.
 */
CsetUtils.importFilesCSETD = function (files, editor)
{
    if (files.length == 0)
    {
        return;
    }

    var file = files[0];
    var reader = new FileReader();
    reader.onload = function (e)
    {
        TranslateToMxGraph(editor, e.target.result);
    };
    reader.readAsText(file);
}

/**
 * Persists the CSETD XML to the CSET API.  The mxGraph translation
 * is returned, and dropped into the existing graph.
 */
function TranslateToMxGraph(editor, sXML)
{
    var jwt = localStorage.getItem('jwt');

    var req = {};
    req.DiagramXml = sXML;

    var url = localStorage.getItem('cset.host') + 'diagram/importcsetd';
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function ()
    {
        if (this.readyState == 4 && (this.status == 200 || this.status == 204))
        {
            // successful post - drop the XML that came back into the graph
            var data = xhr.responseText;
            data = Graph.zapGremlins(mxUtils.trim(data));

            // fix escaped quotes and trim quotes
            data = data.replace(/\\"/g, '"').replace(/^\"|\"$/g, '');

            editor.graph.model.beginUpdate();
            try
            {
                editor.setGraphXml(mxUtils.parseXml(data).documentElement);
            }
            catch (e)
            {
                error = e;
                console.log('TranslateToMxGraph error: ' + error);
            }
            finally
            {
                editor.graph.model.endUpdate();
                CsetUtils.initializeZones(editor.graph);

                editor.graph.fit();
                if (editor.graph.view.scale > 1)
                {
                    editor.graph.zoomTo(1);
                }
            }
        }
        if (this.readyState == 4 && this.status == 401)
        {
            window.location.replace('error401.html');
        }
    }
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', jwt);
    xhr.send(JSON.stringify(req));
}

/**
 * 
 */
CsetUtils.initializeZones = function (graph)
{
    var allCells = graph.getChildVertices(graph.getDefaultParent());
    allCells.forEach(x =>
    {
        x.setAttribute('internalLabel', x.getAttribute('label'));

        x.initZone();
    });
    graph.refresh();
}

/**
 * 
 */
CsetUtils.handleZoneChanges = function (edit)
{
    edit.changes.forEach(change =>
    {
        if (change instanceof mxValueChange && change.cell.isZone())
        {
            var c = change.cell;

            // if they just changed the label, update the internal label
            if (change.value.attributes.label.value != change.previous.attributes.label.value)
            {
                c.setAttribute('internalLabel', change.value.attributes.label.value);
            }

            c.initZone();
        }
    });
}

