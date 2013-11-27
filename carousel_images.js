/*  carousel_images.js
    
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

var carousel_images = ( this.XS || require( 'excess' ).XS ).xs
  .set( [
    { name: 'images/carousel-01.jpg' },
    { name: 'images/carousel-02.jpg' },
    { name: 'images/carousel-03.jpg' },
    { name: 'images/carousel-04.jpg' },
    { name: 'images/carousel-05.jpg' },
    { name: 'images/carousel-06.jpg' }
  ] )
  .set_flow( 'carousel_images' )
  .auto_increment()
;

if ( typeof module != 'undefined' ) module.exports = carousel_images;
