/*  castorcad.js
    
    ----
    
    Copyright (C) 2013, Connected Sets

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
"use strict";

var XS     = require( 'excess' ).XS
  , path   = require(  'path'  )
  , xs     = XS.xs
  , log    = XS.log
  , extend = XS.extend
;

require( 'excess/lib/server/file.js'              );
require( 'excess/lib/server/http.js'              );
require( 'excess/lib/server/socket_io_clients.js' );
require( 'excess/lib/server/uglify.js'            );
require( 'excess/lib/server/mailer.js'            );
require( 'excess/lib/server/thumbnails.js'        );

require( 'excess/lib/uri.js'   );
require( 'excess/lib/join.js'  );
require( 'excess/lib/order.js' );
require( 'excess/lib/form.js'  );

require( './js/dropbox.js'            );
require( './js/directory_manifest.js' );

/* -------------------------------------------------------------------------------------------
   de&&ug()
*/
var de = true;
  
function ug( m ) {
  log( "castorcad, " + m );
} // ug()

module.exports = function( servers ) {

/* -------------------------------------------------------------------------------------------
   Load and Serve Assets
*/

// watch Dropbox directories
var dropbox_directories = xs
      .set( [ { path: '~/Dropbox/Apps/CastorCAD/albums' } ] )
      
      .union()
  
  , entries = dropbox_directories.watch_directories()
;

entries
  
  .filter( [ { type: 'directory' } ] )
  
  ._add_destination( dropbox_directories )
;

var client_min = xs
  .union( [
    xs.set( [
      { path: 'js/es5.js'   },
      { path: 'js/json2.js' },
      { path: 'js/uuid.js'  }
    ] ),
    
    xs.set( [
      // xs.core
      { name: 'excess/lib/xs.js'           },
      { name: 'excess/lib/code.js'         },
      { name: 'excess/lib/query.js'        },
      { name: 'excess/lib/transactions.js' },
      { name: 'excess/lib/pipelet.js'      },
      { name: 'excess/lib/filter.js'       },
      { name: 'excess/lib/order.js'        },
      { name: 'excess/lib/aggregate.js'    },
      { name: 'excess/lib/join.js'         },
      { name: 'excess/lib/events.js'       },
      { name: 'excess/lib/uri.js'          },
      { name: 'excess/lib/last.js'         },
      
      // xs.ui
      { name: 'excess/lib/selector.js'                },
      { name: 'excess/lib/client/animation_frames.js' },
      { name: 'excess/lib/client/url.js'              },
      { name: 'excess/lib/form.js'                    },
      { name: 'excess/lib/load_images.js'             },
      { name: 'excess/lib/bootstrap_photo_album.js'   },
      { name: 'excess/lib/bootstrap_carousel.js'      },
      
      // socket.io server access
      { name: 'excess/lib/socket_io_crossover.js' },
      { name: 'excess/lib/socket_io_server.js'    }
    ] )
    .require_resolve(),
    
    xs.set( [
      { path: 'contact_form_fields.js' },
      { path: 'gallery_images.js'      },
      { path: 'carousel_images.js'     },
      { path: 'albums_images.js'       },
      { path: 'projects_images.js'     }
    ] )
  ] )
  
  .auto_increment()
  
  .watch( { base_directory: __dirname } )
  
  .order( [ { id: 'id' } ] ) // order loaded files
  
  .uglify( 'js/xs-0.2.4.min.js', { warnings: false } )
;

// carousel images, gallery images and projects images thumbnails
var carousel_images = require( './carousel_images.js' )
  , gallery_images  = require( './gallery_images.js'  )
  , projects_images = require( './projects_images.js' )
  , dropbox_images  = entries
      
      .delay( 1000 )
      
      .directory_manifest( 'http://www.castorcad.com/albums.html' )
      
      .trace( 'manifests' )
;

// architects
var architects = dropbox_images
  
  .filter( [ { type: 'directory', depth: 1 } ] )
  
  .alter( alter_architects )
  
  .trace( 'architects' )
;

// projects
var projects = dropbox_images
  
  .filter( [ { type: 'directory', depth: 2 } ] )
  
  .alter( alter_projects )
  
  .join( architects, [ [ 'architects_dirname', 'architects_dirname' ] ], projects_architects )
  
  .trace( 'projects' )
;

var albums_images = dropbox_images
  
  .filter( [ { type: 'file', depth: 4, extension: 'jpg' }, { type: 'file', depth: 4, extension: 'png' } ] )
  
  .alter( alter_images )
  
  .join( projects, [ [ 'projects_dirname', 'projects_dirname' ] ], images_metadata )
  
  .auto_increment( { attribute: 'order' } )
  
  .dropbox_public_urls()
  
  .set_flow( 'albums_images' )
  
  .trace( 'albums images' )
;

albums_images.thumbnails( { path: 'thumbnails/', width: 638, height: 360, base_directory: __dirname } );

var albums_thumbnails = dropbox_images
  
  .filter( [ { type: 'file', depth: 5, extension: 'jpg' }, { type: 'file', depth: 5, extension: 'png' } ] )
  
  .alter( alter_thumbnails )
  
  .join( albums_images, [ [ 'images_dirname', 'images_dirname' ], [ 'image_source', 'image_basename' ] ], thumbnails_metadata )
  
  .dropbox_public_urls()
  
  .set_flow( 'albums_thumbnails' )
  
  .trace( 'albums thumbnails' )
;


var gallery_thumbnails = gallery_images
  .thumbnails( { width: 125, height: 80, base_directory: __dirname } )
  .set_flow( 'gallery_thumbnails' )
;

var projects_thumbnails = projects_images
  .thumbnails( { width: 700, height: 520, base_directory: __dirname } )
  .set_flow( 'projects_thumbnails' )
;


var files = xs
  .set( [
    // HTML pages
    { path: 'index.html'   },
    { path: 'gallery.html' },
    { path: 'albums.html'  },
    
    // CSS files
    { path: 'css/base.css'             },
    { path: 'css/responsive_fixes.css' },
    { path: 'css/projects.css'         },
    { path: 'css/gallery.css'          },
    { path: 'css/albums.css'           },
    { path: 'css/modal.css'            },
    
    // JS files
    { path: 'js/hammer.js'             },
    { path: 'js/navigation.js'         },
    { path: 'js/modal.js'              },
    { path: 'js/carousel.js'           },
    { path: 'js/gallery.js'            },
    { path: 'js/projects.js'           },
    { path: 'js/contact.js'            },
    { path: 'js/albums.js'             },
    
    // jQuery plugins
    { path: 'js/jquery.ui.totop.js'    },
    { path: 'js/jquery.easing.1.3.js'  },
    
    // additional PNG images for css styles
    { path: 'images/favicon.png'       },
    { path: 'images/logo.png'          },
    { path: 'images/sprite.png'        },
    { path: 'images/ui.totop.png'      }
    
  ] )
  .auto_increment()
  .union( [ carousel_images, gallery_images, gallery_thumbnails, projects_images, projects_thumbnails ] )
  .watch( { base_directory: __dirname } )
  .union( [ client_min ] )
;

servers.http_listen( files );

files.serve( servers );

var contact_form_fields = require( "./contact_form_fields.js" )
  .order( [ { id: 'order_id' } ] )
;

// Serve contact_form_fields to socket.io clients
contact_form_fields
  .union( [
      carousel_images    .to_uri()
    , gallery_images     .to_uri()
    , gallery_thumbnails .to_uri()
    , projects_images    .to_uri()
    , projects_thumbnails.alter( path_to_uri )
    , albums_images
    , albums_thumbnails
  ] )
  
  .trace( 'contact_form_fields, images and thumbnails to clients' )
  
  // Start socket.io server, and dispatch client connections to provide contact_form_fields and get filled contact forms
  .dispatch( servers.socket_io_clients(), function( source, options ) {
    return this.socket._add_source( source );
  } )
  
  .trace( 'contact form received from client' )
  
  // Validate form, just in case the contact form code has been altered on the client
  .form_validate( 'contact_form', contact_form_fields )
  
  .trace( 'form_validate' )
  
  .flow( 'contact_form' ) // filter errors out
  
  .trace( 'validated form' )
  
  .alter( function( form ) {
    var full_name = form[ 'full-name' ];
    
    return {
      messageId: form.id,
      
      from: 'CastorCAD contact form <info@castorcad.com>',
      
      to: 'Info <info@castorcad.com>',
      
      bcc: [
        'Samy Vincent <svincent@castorcad.com>',
        'Marcel K\' Nassik <knassik@gmail.com>',
        'Jean Vincent <uiteoi@gmail.com>'
      ],
      
      reply_to: full_name + ' <' + form.email + '>',
      
      subject: 'CastorCAD Contact Form Received from ' + full_name,
      
      html: '<h3>CastorCAD Contact Form:</h3>'
        + '<p>From: <a href="mailto:' + full_name.replace( ' ', '%20' ) + '<' + form.email + '>">' + '<b>' + full_name + '</b> ' + form.email + '</a></p>'
        + '<p>Company: <b>' + ( form.company || '' ) + '</b></p>'
        + '<p>Message:<p>'
        + '<p>' + form.text + '</p>'
    };
  }, { no_clone: true } )
  
  .trace( 'send email' )
  
  .send_mail( xs.configuration() )
  
  .trace( 'email sent' )
;

function alter_architects( file ) {
  file.architect_id       = file.manifest.id;
  file.architects_dirname = file.path;

  delete file.manifest;
} // alter_architects()

function alter_projects( file ) {
  file.project_id         = file.manifest.id;
  file.architects_dirname = path.dirname( file.path );
  file.projects_dirname   = file.path;

  delete file.manifest;
} // alter_projects()

function alter_images( file ) {
  var a = file.path.split( '/' );

  file.projects_dirname = a.slice( 0, a.length - 2 ).join( '/' );
  file.images_dirname   = a.slice( 0, a.length - 1 ).join( '/' );
  file.image_id         = file.manifest.id;

  delete file.manifest;
} // alter_images()

function alter_thumbnails( file ) {
  var a = file.path.split( '/' );

  file.images_dirname = a.slice( 0, a.length - 2 ).join( '/' );
  file.image_source   = a[ a.length - 1 ].split( '-' )[ 0 ] + '.' + file.extension;

  file.thumbnail_id  = file.manifest.id;

  delete file.manifest;
} // _thumbnails()

function projects_architects( project, architect ) {
  return {
      architect_id    : architect.architect_id
    , project_id      : project.project_id
    , projects_dirname: project.projects_dirname
  };
} // architects_projects()

function images_metadata( image, project ) {
  var filepath         = image.path
    , dropbox_filepath = filepath.match( '~/Dropbox/Apps/CastorCAD/(.*)' )[ 1 ]
    , array            = dropbox_filepath.split( '/' )
  ;

  return {
      architect_id    : project.architect_id
    , architect_name  : array[ 1 ]
    , project_name    : array[ 2 ]
    , image_name      : array[ 3 ]
    , path            : filepath
    , dropbox_filepath: dropbox_filepath
    , date            : image.mtime
    , images_dirname  : image.images_dirname
    , image_basename  : path.basename( filepath )
  };
} // images_metadata()

function thumbnails_metadata( thumbnail, image ) {
  return {
      order           : image.order
    , architect_id    : image.architect_id
    , architect_name  : image.architect_name
    , project_name    : image.project_name
    , image_name      : image.image_name
    , path            : thumbnail.path
    , dropbox_filepath: thumbnail.path.match( '~/Dropbox/Apps/CastorCAD/(.*)' )[ 1 ]
    , date            : image.date
  };
} // images_thumbnails()

function path_to_uri( entry ) {
  entry.uri = entry.path;
  
  delete entry.path;
}

} // module.exports