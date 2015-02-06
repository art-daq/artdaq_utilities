var defaultColor = "";
var defaultShadow = "";
var brs = {};

var addBR = function ( id,br ) {
    brs[id] = br;
    $.get( "/artdaq-configuration/BoardReader.html",function ( data ) {
        var datatemp = data.replace( /%id%/g,id );
        $( "#brs" ).append( datatemp ).collapsibleset( 'refresh' ).trigger( 'create' );
        $( "#deletebr" + id ).click( function () {
            $( "#brcfg" + id ).remove( );
            $( "#brs" ).collapsibleset( 'refresh' );
        } );
        $( "#brcfg" + id + " #type" ).change( function () {
            var selected = $( "#brcfg" + id ).find( ':selected' ).val( );
            $.get( "/artdaq-configuration/" + selected + "_generator.html",function ( typedata ) {
                $( "#brcfg" + id + " #typeConfig" ).html( typedata );
                $( "#brcfg" + id + " #typeConfig #config" ).trigger( 'create' ).collapsible( );
                
                for ( var key in brs[id] ) {
                    if ( key.search( "name" ) < 0 && key.search( "type" ) < 0 && key.search( "enabled" ) < 0 ) {
                        $( "#" + key,"#brcfg" + id + " #typeConfig" ).val( br[key] );
                    }
                }
            } );
        } );
        
        if ( br == null) {
            $( "#brcfg" + id + " #type" ).val( "TOY1" ).trigger('change');
        } else {
            $( "#brcfg" + id + " #enabled" ).prop( 'checked',br.enabled ).checkboxradio( 'refresh' );
            $( "#brcfg" + id + " #name" ).val( br.name );
            $( "#brcfg" + id + " #type" ).val( br.type ).trigger('change');
        }
    } );
}

var lastbrid = -1;

var saveConfiguration = function () {
    var output = {};
    output.expertMode = $( "#expertMode" ).is( ":checked" );
    output.configName = $( "#configName" ).val( );
    output.artdaqDir = $( "#artdaqDir" ).val( );
    output.dataDir = $( "#artdaqDataDir" ).val( );
    output.logDir = $( "#artdaqLogDir" ).val( );
    output.dataLogger = {};
    output.dataLogger.enabled = $( "#dlEnabled" ).is( ":checked" );
    output.dataLogger.fileMode = $( "input:radio[name=fileLimit]:checked" ).val( );
    output.dataLogger.fileValue = $( "#limitValue" ).val( );
    output.dataLogger.runMode = $( "input:radio[name=runLimit]:checked" ).val( );
    output.dataLogger.runValue = $( "#runLimitValue" ).val( );
    output.onlineMonitor = {};
    output.onlineMonitor.enabled = $( "#omEnabled" ).is( ":checked" );
    output.onlineMonitor.viewerEnabled = $( "#omvEnabled" ).is( ":checked" );
    output.eventBuilders = {};
    output.eventBuilders.basename = $( "#evbName" ).val( );
    output.eventBuilders.count = $( "#evbCount" ).val( );
    output.eventBuilders.compress = $( "#evbCompress" ).is( ":checked" );
    output.boardReaders = [];
    $( "#brs" ).children( ).each( function ( index,element ) {
        var br = {};
        var selected = $( this ).find( ':selected' );
        br.type = selected.val( );
        $( "input",this ).each( function ( innerIndex,innerElement ) {
            if ( $( innerElement ).is( ":checkbox" ) ) {
                br[innerElement.id] = $( innerElement ).is( ":checked" );
            } else {
                br[innerElement.id] = $( innerElement ).val( );
            }
        } );
        output.boardReaders.push( br );
    } );
    return output;
};

var loadConfiguration = function ( config ) {
    lastbrid = -1;
    $( "#brs" ).html( "" );
    
    $( "#expertMode" ).prop( 'checked',config.expertMode );
    $( "#configName" ).val( config.configName );
    $( "#artdaqDir" ).val( config.artdaqDir );
    $( "#artdaqDataDir" ).val( config.dataDir );
    $( "#artdaqLogDir" ).val( config.logDir );
    $( "#dlEnabled" ).prop( 'checked',config.dataLogger.enabled );
    $( "input:radio[name=fileLimit]:checked" ).prop( 'checked',false );
    $( "#fileLimit" + config.dataLogger.fileMode ).prop( 'checked',true );
    $( "#limitValue" ).val( config.dataLogger.fileValue );
    $( "input:radio[name=runLimit]:checked" ).prop( 'checked',false );
    $( "#runLimit" + config.dataLogger.runMode ).prop( 'checked',true );
    $( "#runLimitValue" ).val( config.dataLogger.runValue );
    $( "#omEnabled" ).prop( 'checked',config.onlineMonitor.enabled );
    $( "#omvEnabled" ).prop( 'checked',config.onlineMonitor.viewerEnabled );
    $( "#evbName" ).val( config.eventBuilders.basename );
    $( "#evbCount" ).val( config.eventBuilders.count );
    $( "#evbCompress" ).prop( 'checked',config.eventBuilders.compress );
    for ( var index in config.boardReaders ) {
        var br = config.boardReaders[index];
        ++lastbrid;
        addBR( lastbrid, br );
    }
    $( "input:radio" ).checkboxradio( 'refresh' );
    $( "input:checkbox" );
}

var updateHeader = function ( error,text ) {
    if ( error ) {
        $( "#header" ).css( "background-color","red" ).css( "text-shadow","#E55 0px 1px 0px" );
        $( "#info" ).text( text );
    } else {
        $( "#header" ).css( "background-color",defaultColor ).css( "text-shadow",defaultShadow );
        $( "#info" ).text( text );
    }
}

var loadConfigs = function () {
    AjaxGet( "/artdaq-configuration/NamedConfigs",function ( data ) {
        $( "#configs" ).html( data ).trigger( 'create' ).selectmenu( 'refresh' );
    } );
}

$( document ).ready( function () {
    defaultColor = $( "#header" ).css( "background-color" );
    defaultShadow = $( "#header" ).css( "text-shadow" );
    var changedText = "Please define a Configuration Name and click \"Save Configuration\" to save your pending changes. Loading a configuration, navigating away from this page, or closing this page will discard your changes.";
    
    
    $( ".triggersModified" ).change( function () {
        updateHeader( true,changedText );
    } );
    
    $( ".triggersModified" ).click( function () {
        configModified = true;
        updateHeader( true,changedText );
    } )
    
    $( "#addbr" ).click( function () {
        ++lastbrid;
        addBR( lastbrid );
    } );
    
    loadConfigs( );
    
    $( "#loadConfigButton" ).click( function () {
        updateHeader( false,"" );
        var selected = $( "#configs" ).find( ':selected' ).val( );
        AjaxPost( "/artdaq-configuration/LoadNamedConfig",{ configName: selected },function ( config ) {
            loadConfiguration( config );
        } );
    } );
    $( "#saveConfig" ).click( function () {
        var config = saveConfiguration( );
        AjaxPost( "/artdaq-configuration/saveConfig",{ config: JSON.stringify( config ) },function ( res ) {
            if ( res !== null && res.Success ) {
                updateHeader( false,"Configuration Saved." );
            } else {
                updateHeader( true,"Failed to save configuration!" );
            }

            loadConfigs( );
        } );
    } );
} );