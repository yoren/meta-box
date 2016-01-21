window.rwmb = window.rwmb || {};

jQuery( function ( $ )
{
	'use strict';

	var views = rwmb.views = rwmb.views || {},
		MediaField, MediaList, MediaItem, ImageField, ImageList, ImageItem, MediaButton, MediaStatus, UploadButton;

	MediaList = views.MediaList = Backbone.View.extend( {
		tagName       	: 'ul',
		className     	: 'rwmb-media-list',
		createItemView: function ( options )
		{
			return new MediaItem( options );
		},

		addItemView: function ( item )
		{
			this.itemViews[item.cid] = this.createItemView( {
				model     : item,
				collection: this.collection,
				props     : this.props
			} );
			this.$el.append( this.itemViews[item.cid].el );
		},

		render: function ()
		{
			this.$el.empty();
			this.collection.each( this.addItemView );
		},

		initialize: function ( options )
		{
			var that = this;
			this.itemViews = {};
			this.props = options.props;

			this.listenTo( this.collection, 'add', this.addItemView );

			this.listenTo( this.collection, 'remove', function ( item, collection )
			{
				if ( this.itemViews[item.cid] )
				{
					this.itemViews[item.cid].remove();
					delete this.itemViews[item.cid];
				}
			} );

			//Sort media using sortable
			this.$el.sortable( { delay: 150 } );

			this.render();
		}
	} );

	ImageList = views.ImageList = MediaList.extend( {
		createItemView: function ( options )
		{
			return new ImageItem( options );
		}
	} );

	MediaField = views.MediaField = Backbone.View.extend( {
		initialize: function ( options )
		{
			var that = this;
			this.$input = $( options.input );
			this.values = this.$input.val().split( ',' );
			this.props = new Backbone.Model( this.$el.data() );
			this.props.set( 'fieldName', this.$input.attr( 'name' ) );

			//Create collection
			this.collection = new wp.media.model.Attachments();

			//Render
			this.render();

			//Limit max files
			this.listenTo( this.collection, 'add', function ( item, collection )
			{
				var maxFiles = this.props.get( 'maxFiles' );
				if ( maxFiles > 0 && this.collection.length > maxFiles )
				{
					this.collection.pop();
				}
			} );

			//Load initial media
			if ( !_.isEmpty( this.values ) )
			{
				this.collection.props.set( {
					query  : true,
					include: this.values,
					orderby: 'post__in',
					order  : 'ASC',
					type   : this.props.get( 'mimeType' ),
					perPage: this.props.get( 'maxFiles' ) || -1
				} );
				this.collection.more();
			}

			//Listen for destroy event on input
			this.$input
				.on( 'remove', function(){
					if ( that.props.gat( 'forceDelete' ) )
					{
						_.each( _.clone( that.collection.models ), function ( model )
						{
							model.destroy();
						} );
					}
				} )
				.on( 'set', function(){
					that.props.set( 'fieldName', that.$input.attr( 'name' ) );
				})
		},

		render: function ()
		{
			//Empty then add parts
			this.$el.empty();
			this.$el.append( new MediaList( { collection: this.collection, props: this.props } ).el );
			this.$el.append( new MediaButton( { collection: this.collection, props: this.props } ).el );
			this.$el.append( new MediaStatus( { collection: this.collection, props: this.props } ).el );
		}
	} );

	ImageField = views.ImageField = MediaField.extend( {
		render: function ()
		{
			this.$el.empty();
			this.$el.append( new ImageList( { collection: this.collection, props: this.props } ).el );
			this.$el.append( new MediaButton( { collection: this.collection, props: this.props } ).el );
			this.$el.append( new MediaStatus( { collection: this.collection, props: this.props } ).el );
		}
	} );

	MediaStatus = views.MediaStatus = Backbone.View.extend( {
		tagName   : 'span',
		className : 'rwmb-media-status',
		template  : wp.template( 'rwmb-media-status' ),
		initialize: function ( options )
		{
			this.props = options.props;
			this.listenTo( this.collection, 'add remove reset', this.render );
			this.render();
		},

		render: function ()
		{
			var data = {
				items   : this.collection.length,
				maxFiles: this.props.get( 'maxFiles' )
			};
			this.$el.html( this.template( data ) );
		}
	} );

	MediaButton = views.MediaButton = Backbone.View.extend( {
		className: 'rwmb-add-media button',
		tagName  : 'a',
		template : wp.template( 'rwmb-add-media' ),
		events   : {
			click: function ()
			{
				var models = this.collection.models;

				// Destroy the previous collection frame.
				if ( this._frame )
				{
					this.stopListening( this._frame );
					this._frame.dispose();
				}

				this._frame = wp.media( {
					className: 'media-frame rwmb-media-frame',
					multiple : true,
					title    : 'Select Media',
					editing  : true,
					library  : {
						type: this.props.get( 'mimeType' )
					}
				} );

				this.listenTo( this._frame, 'select', function ()
				{
					var selection = this._frame.state().get( 'selection' );
					this.collection.add( selection.models );
				} );

				this._frame.open();
			}
		},
		render   : function ()
		{
			this.$el.html( this.template( {} ) );
			return this;
		},

		initialize: function ( options )
		{
			this.props = options.props;
			this.listenTo( this.collection, 'add remove reset', function ()
			{
				var maxFiles = this.props.get( 'maxFiles' );
				if ( maxFiles > 0 && this.collection.length >= maxFiles )
				{
					this.$el.hide();
				}
				else
				{
					this.$el.show();
				}
			} );

			this.render();
		}
	} );

	MediaItem = views.MediaItem = Backbone.View.extend( {
		tagName   : 'li',
		className : 'rwmb-media-item',
		template  : wp.template( 'rwmb-media-item' ),
		initialize: function ( options )
		{
			this.props = options.props;
			this.render();
			this.listenTo( this.model, 'destroy', function ( model )
			{
				this.collection.remove( this.model );
			} );
		},

		events: {
			'click .rwmb-remove-media': function ( e )
			{
				this.collection.remove( this.model );
				if ( this.props.get( 'forceDelete' ) )
				{
					this.model.destroy();
				}

				return false;
			}
		},

		render: function ()
		{
			var attrs = _.clone( this.model.attributes );
			attrs.fieldName = this.props.get( 'fieldName' );
			this.$el.html( this.template( attrs ) );
			return this;
		}
	} );

	ImageItem = views.ImageItem = MediaItem.extend( {
		className: 'rwmb-image-item',
		template : wp.template( 'rwmb-image-item' )
	} );

	/**
	 * Initialize media fields
	 * @return void
	 */
	function initMediaField()
	{
		new MediaField( { input: this, el: $( this ).siblings( 'div.rwmb-media-view' ) } );
	}

	function initImageField()
	{
		new ImageField( { input: this, el: $( this ).siblings( 'div.rwmb-media-view' ) } );
	}

	$( ':input.rwmb-file_advanced' ).each( initMediaField );
	$( ':input.rwmb-image_advanced' ).each( initImageField );
	$( '.rwmb-input' )
		.on( 'clone', ':input.rwmb-file_advanced', initMediaField )
		.on( 'clone', ':input.rwmb-image_advanced', initImageField )
} );
