var testData;
var defaultColor = "";
var defaultShadow = "";
var tableHTML;
var currentNamedConfig;

function getUrlParameter(sParam) {
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0].search(sParam) > 0) {
            return sParameterName[1];
        }
    }
}

var makeTreeGrid = function (tag) {
    var employees = [
        {
            "EmployeeID": 2, "FirstName": "Andrew", "LastName": "Fuller", "Country": "USA", "Title": "Vice President, Sales", "HireDate": "1992-08-14 00:00:00", "BirthDate": "1952-02-19 00:00:00", "City": "Tacoma", "Address": "908 W. Capital Way", "expanded": "true",
            children: [
                { "EmployeeID": 8, "FirstName": "Laura", "LastName": "Callahan", "Country": "USA", "Title": "Inside Sales Coordinator", "HireDate": "1994-03-05 00:00:00", "BirthDate": "1958-01-09 00:00:00", "City": "Seattle", "Address": "4726 - 11th Ave. N.E." },
                { "EmployeeID": 1, "FirstName": "Nancy", "LastName": "Davolio", "Country": "USA", "Title": "Sales Representative", "HireDate": "1992-05-01 00:00:00", "BirthDate": "1948-12-08 00:00:00", "City": "Seattle", "Address": "507 - 20th Ave. E.Apt. 2A" },
                { "EmployeeID": 3, "FirstName": "Janet", "LastName": "Leverling", "Country": "USA", "Title": "Sales Representative", "HireDate": "1992-04-01 00:00:00", "BirthDate": "1963-08-30 00:00:00", "City": "Kirkland", "Address": "722 Moss Bay Blvd." },
                { "EmployeeID": 4, "FirstName": "Margaret", "LastName": "Peacock", "Country": "USA", "Title": "Sales Representative", "HireDate": "1993-05-03 00:00:00", "BirthDate": "1937-09-19 00:00:00", "City": "Redmond", "Address": "4110 Old Redmond Rd." },
                {
                    "EmployeeID": 5, "FirstName": "Steven", "LastName": "Buchanan", "Country": "UK", "Title": "Sales Manager", "HireDate": "1993-10-17 00:00:00", "BirthDate": "1955-03-04 00:00:00", "City": "London", "Address": "14 Garrett Hill", "expanded": "true",
                    children: [
                        { "EmployeeID": 6, "FirstName": "Michael", "LastName": "Suyama", "Country": "UK", "Title": "Sales Representative", "HireDate": "1993-10-17 00:00:00", "BirthDate": "1963-07-02 00:00:00", "City": "London", "Address": "Coventry House Miner Rd." },
                        { "EmployeeID": 7, "FirstName": "Robert", "LastName": "King", "Country": "UK", "Title": "Sales Representative", "HireDate": "1994-01-02 00:00:00", "BirthDate": "1960-05-29 00:00:00", "City": "London", "Address": "Edgeham Hollow Winchester Way" },
                        { "EmployeeID": 9, "FirstName": "Anne", "LastName": "Dodsworth", "Country": "UK", "Title": "Sales Representative", "HireDate": "1994-11-15 00:00:00", "BirthDate": "1966-01-27 00:00:00", "City": "London", "Address": "7 Houndstooth Rd." }
                    ]
                }
            ]
        }
    ];
    // prepare the data
    var source =
 {
        dataType: "json",
        dataFields: [
            { name: 'EmployeeID', type: 'number' },
            { name: 'FirstName', type: 'string' },
            { name: 'LastName', type: 'string' },
            { name: 'Country', type: 'string' },
            { name: 'City', type: 'string' },
            { name: 'Address', type: 'string' },
            { name: 'Title', type: 'string' },
            { name: 'HireDate', type: 'date' },
            { name: 'children', type: 'array' },
            { name: 'expanded', type: 'bool' },
            { name: 'BirthDate', type: 'date' }
        ],
        hierarchy:
 {
            root: 'children'
        },
        id: 'EmployeeID',
        localData: employees
    };
    var dataAdapter = new $.jqx.dataAdapter(source);
    // create Tree Grid
    tag.jqxTreeGrid(
        {
            width: 850,
            source: dataAdapter,
            editable: true,
            editSettings: { saveOnPageChange: true, saveOnBlur: true, saveOnSelectionChange: true, cancelOnEsc: true, saveOnEnter: true, editSingleCell: true, editOnDoubleClick: true, editOnF2: true },
            sortable: true,
            columns: [
                { text: 'FirstName', dataField: 'FirstName', width: 200 },
                { text: 'LastName', dataField: 'LastName', width: 200 },
                { text: 'City', dataField: 'City', width: 200 },
                { text: 'Country', dataField: 'Country' }
            ]
        });
    // Cell Begin Edit
    tag.on('cellBeginEdit', function (event) {
        var args = event.args;
        // row key
        var rowKey = args.key;
        // row's data.
        var rowData = args.row;
        // column's data field.
        var columnDataField = args.dataField;
        // column's display field.
        var columnDisplayField = args.displayField;
        // cell's value.
        var value = args.value;
        $("#debug").html("cellBeginEdit - Row ID: " + rowKey + ", Column: " + columnDataField + ", Value: " + value + "<br/>" + $("#debug").html());
        
    });
    // Cell End Edit
    tag.on('cellEndEdit', function (event) {
        var args = event.args;
        // row key
        var rowKey = args.key;
        // row's data.
        var rowData = args.row;
        // column's data field.
        var columnDataField = args.dataField;
        // column's display field.
        var columnDisplayField = args.displayField;
        // cell's value.
        var value = args.value;
        $("#debug").html("<br/>cellEndEdit - Row ID: " + rowKey + ", Column: " + columnDataField + ", Value: " + value + "<br/>" + $("#debug").html());
        
    });
}

var loadTable = function (categoryNum, tableNum, tag) {
    AjaxPost('/db/GetData', { config: currentNamedConfig, category: categoryNum, table: tableNum }, function (data) {
        var dataObj = JSON.parse(data);
        var columns = [];
        var paths = [];
        var maxlevel = 0;
        for (var itemN in dataObj) {
            var item = dataObj[itemN];
            for (var prop in item) {
                if (item.hasOwnProperty(prop) && columns.indexOf(prop) == -1) {
                    columns.push(prop);
                }
            }
        }
        makeTreeGrid($('.tabs ' + tag)).trigger('create');
    });
}

var loadConfigs = function () {
    AjaxGet("/db/NamedConfigs", function (data) {
        $("#configs").html(data.join("")).trigger('create').selectmenu('refresh');
        var config = getUrlParameter("configs");
        if (config !== undefined) {
            $("#configs").val(config);
        }
    });
}

var updateHeader = function (error, text) {
    if (error) {
        $("#header").css("background-color", "red").css("text-shadow", "#E55 0px 1px 0px");
        $("#info").text(text);
    } else {
        $("#header").css("background-color", defaultColor).css("text-shadow", defaultShadow);
        $("#info").text(text);
    }
}

var registerTabFunctions = function () {
    $('.tabs .table-data a').off();
    $('.tabs .tab-links a').off().on('click', function (e) {
        var currentAttrValue = $(this).attr('href');
        
        // Show/Hide Tabs
        $('.tabs ' + currentAttrValue).show().siblings().hide();
        
        // Change/remove current tab to active
        $(this).parent('li').addClass('active').siblings().removeClass('active');
        
        e.preventDefault();
    });
    $('.table-data a').on('click', function (e) {
        var currentAttrValue = $(this).attr('href');
        var matches = currentAttrValue.match(/#tab(\d+) #tabletab(\d+)/);
        loadTable(parseInt(matches[1]) - 2, parseInt(matches[2]) - 1, currentAttrValue);
    });
}

$(document).ready(function () {
    defaultColor = $("#header").css("background-color");
    defaultShadow = $("#header").css("text-shadow");
    
    $.get("/db/Tables.html", function (data) {
        tableHTML = data;
    });
    
    registerTabFunctions();
    $('.tabs #tab1').show().siblings().hide();
    
    $("#loadConfigButton").click(function () {
        configNeedsRestart = false;
        updateHeader(false, "");
        currentNamedConfig = $("#configs").find(':selected').val();
        AjaxPost("/db/LoadNamedConfig", { configFile: currentNamedConfig }, function (config) {
            var configObj = JSON.parse(config);
            for (var category in configObj) {
                var catNum = parseInt(category) + 2;
                $("#tabLinks").append("<li><a href=\"#tab" + catNum + "\">" + configObj[category].name + "</a></li>");
                $("#tabContents").append("<div id=tab" + catNum + " class=\"tab\"></div>");
                $("#tab" + catNum).html(tableHTML);
                var tableObj = configObj[category].tables;
                for (var table in tableObj) {
                    var tabNum = parseInt(table) + 1;
                    $("#tab" + catNum + " #tabletabLinks").append("<li><a href=\"#tab" + catNum + " #tabletab" + tabNum + "\">" + tableObj[table] + "</a></li>");
                    $("#tab" + catNum + " #tabletabContents").append("<div id=tabletab" + tabNum + " class=\"tab\"></div>");
                    registerTabFunctions();
                }
                registerTabFunctions();
            }
        });
    });
    loadConfigs();
    
    $("#saveConfig").click(function () {
        var config = saveConfiguration();
        AjaxPost("/db/saveConfig", { config: JSON.stringify(config) }, function (res) {
            if (res !== null && res.Success) {
                updateHeader(false, "Configuration Saved.");
            } else {
                updateHeader(true, "Failed to save configuration!");
            }
            
            loadConfigs();
        });
    });
});