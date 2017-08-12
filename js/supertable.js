(function() {
  var Supertable = this.Supertable = {};

  var Data = Supertable.Data = Backbone.Model;
  var HeaderCell = Supertable.HeaderCell = Backbone.Model;
  var Table = Supertable.Table = Backbone.Model.extend({
    initialize: function() {
      console.log(' Supertable initialize  ');
      this.originalRows = _.clone(this.get("rows"));
    },
    doTransforms: function() {
      var newRows = _.clone(this.originalRows);
      if (!_.isUndefined(this.currentSort)) {
        newRows = this._sort.apply(this, this.currentSort)(newRows);  // currentSort = sort ags
      }
      this.set("rows", newRows);
    },
    sort: function(direction, section, attr) {
      this.currentSort = arguments;  //???  just of this midget function?
      this.doTransforms();
    },
    _sort: function(direction, section, attr) {
      return function(rows) {
        var less = direction == "asc" ? -1 : 1;
        var more = -less;
        rows.sort(function(left, right) {
          var a = left[section][attr];
          var b = right[section][attr];
          if (_.isUndefined(a) || _.isNull(a)) {
            return less;
          }
          else if (_.isUndefined(b) || _.isNull(b)) {
            return more;
          }
          else if (a < b) {
            return less;
          }
          else {
            return more;
          }
        });
        return rows;
      };
    },
      // When used?  in aggregation!
    values: function(section, attr) {
      return _.chain(this.get("rows")).pluck(section).pluck(attr).value();
    },
    // possibly move these two to a untils class
    intSum: function(values) {
      var returnValue = 0;
      values.forEach(function(cellValue){
          returnValue += parseInt(cellValue);
      });
      return returnValue;
    },
    floatSum: function(values) {
      var returnValue = 0;
      values.forEach(function(cellValue){
          returnValue += parseFloat(cellValue);
      });
      return returnValue;
    },
    giveAggregation: function(section, attr, numType, aggregationType) {
      /*
          TODO
        what about nulls!
        What about strings in wrong columns
       */
      var values = this.values(section, attr), returnValue, sum;
      // Move elsewhere if an aggregation does not require sum
      if (numType == 'float') {
        sum = this.floatSum(values);
      } else if (numType == 'int') {
        sum = this.intSum(values);
      }
      if (aggregationType === 'sum') { //todo  compare to numeric types below
        returnValue = sum
      } else if (aggregationType === 'average') { //todo  compare to numeric types below
        returnValue = sum / values.length
      }
      // todo else return null? undefined?
      return returnValue;
    }
  });

  var BaseView = Supertable.BaseView = Backbone.View.extend({
    render: function() {
      var attributes = (this.model) ? this.model.attributes : {};
      this.$el.html(this.template(attributes));
      return this;
    }
  });

  var HeaderCellView = Supertable.HeaderCellView = BaseView.extend({
    tagName: "th",
    template: _.template('<a class="name"><%= name %></a> \
      <a class="up" href="#">^</a> \
      <a class="down" href="#">v</a>'),
    events: {
      "click .up": "sortAsc",
      "click .down": "sortDesc",
    },
    sort: function(direction) {
      // call the "main" sort with these three args!
      this.trigger("sort", direction, this.model.get("section"), this.model.get("name"));
      return false;
    },
    sortAsc: function() { return this.sort("asc"); },
    sortDesc: function() { return this.sort("desc"); }
  });

  var RowView = Supertable.RowView = BaseView.extend({
    tagName: "tr",
    className: "data-row",
    initialize: function() {
      console.log('>> initialize arguments: ', arguments);
      // TODO: look for bbone examples with options
      if (arguments[0].options && arguments[0].options.schema) { // todo FIX THIS probably with bbone view functions
        console.log('FOUND arguments.options[0].options: ', arguments[0].options);
        this.options = {
          schema: arguments[0].options.schema
        };
      }
    },
    render: function() {
      var that = this;
      this.$el.empty(); // start over ;)
      _.each(that.options.schema.sections, _.bind(function(section) {
        _.each(section.attributes, _.bind(function(attr) {
          var val = this.model.get(section.name)[attr.name];
          var td = $("<td>");
          if (_.isNull(val) || _.isUndefined(val)) {
            td.text("NULL").addClass("null");
          } else {
            td.text(val);
          }
          this.$el.append(td);
        }, this));  // this - so that the inner vars apply to this view obj
      }, this));
      return this;
    }
  });

  var AttributeConfig = Supertable.AttributeConfig = Backbone.Model.extend({
    numericTypes: ["int", "float"],
    isNumericType: function() {
      return _.contains(this.numericTypes, this.get("type"));
    },
    initialize: function() {
      return;  //??
    }
  });

  var TableView = Supertable.TableView = BaseView.extend({
    tagName: "table",
    template: _.template('<tr class=\"header sections\"></tr>\
      <tr class=\"header attributes\"></tr><tr class=\"header aggregateHeader\"></tr>\
      <tr class=\"header aggregateValue\"></tr>'),
    initialize: function() {
      this.model.on("change:rows", this.renderRows, this);
      this.attributeConfigs = [];
      console.log('>> initialize arguments: ', arguments);
      // TODO: look for bbone examples with options
        if (arguments[0].options && arguments[0].options.schema) { // todo FIX THIS probably with bbone view functions
          console.log('FOUND arguments.options[0].options: ', arguments[0].options);
          this.options = {
            schema: arguments[0].options.schema
          };
        }
    },
    render: function() {
      var that=this; // todo check common solution
      this.stopListening();
      BaseView.prototype.render.apply(this);
      _.each(that.options.schema.sections, _.bind(function(section) { //err?
        // HEADER HEADER
        var th = $('<th>').text(section.name).attr("colspan", section.attributes.length);
        this.$('.sections').append(th);

        _.each(section.attributes, _.bind(function(attr) {
          var attributeConfig = new AttributeConfig(_.extend(attr, {
            attr: attr.name,
            section: section.name
          }));
          // just for test - would move
          this.model.giveAggregation(section.name, attr.name, 'blah');

          this.attributeConfigs.push(attributeConfig);
          var view = new HeaderCellView({model: attributeConfig});
          this.$('.attributes').append(view.render().el); // append to ROW
          // ties the headerView event 'sort' to this-view.sort (below)
          this.listenTo(view, 'sort', _.bind(this.sort, this)); // ties the  . .
        }, this));
      }, this));
      this.renderRows(); //note!
      // render bottom aggregates
      this.renderAggregateHeaderRows();
      this.renderAggregateValuesRows();
      return this;
    },
    renderRows: function() {
      var that = this; // todo check common solution
      this.$("tr.data-row").remove();  //clear all
      _.each(that.model.get("rows"), function(item) {
        var view = new RowView({model: new Data(item), options: {
                                            schema: that.options.schema
                                          }
            // schema: that.options.schema
        });
        view.render().$el.insertAfter(this.$('.attributes')); // insert after this specific part of headr?
      }, this);
    },
    renderAggregateHeaderRows: function() {
      var that=this, td; // todo check common solution
      this.$("tr.aggregateHeader").empty(); //.remove();  //clear all but not the row!

      _.each(that.options.schema.sections, _.bind(function(section) { //err?
        _.each(section.attributes, _.bind(function(attr) {
          if (attr.aggregateType) {
            td = $('<td>').text(attr.aggregateType);  // add a class?
            //.attr("colspan", section.attributes.length);
          } else {
            td = $('<td>'); // add a class?
          }
          this.$('.aggregateHeader').append(td);

        }, this));
      }, this));
    },
    renderAggregateValuesRows: function() {
      var that=this, td, aggVal; // todo check common solution
      this.$("tr.aggregateValue").empty(); //.remove();  //clear all but not the row!

      _.each(that.options.schema.sections, _.bind(function(section) { //err?
        _.each(section.attributes, _.bind(function(attr) {
          console.log('renderAggregateValuesRows  attr: ', attr);
          if (attr.aggregateType) {
            aggVal = this.model.giveAggregation(section.name, attr.name, attr.type, attr.aggregateType);
            td = $('<td>').text(aggVal.toFixed(2));  // add a class?
            //.attr("colspan", section.attributes.length);
          } else {
            td = $('<td>'); // add a class?
          }
          this.$('.aggregateValue').append(td);

        }, this));
      }, this));
    },
    sort: function(direction, section, attr) {
      this.model.sort(direction, section, attr); // sort exists in model but event ties to view to re-render
    }
  });
})();
