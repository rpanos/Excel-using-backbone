(function () {
    var Supertable = this.Supertable = {};

    var Data = Supertable.Data = Backbone.Model;
    var HeaderCell = Supertable.HeaderCell = Backbone.Model;
    var Table = Supertable.Table = Backbone.Model.extend({
        initialize: function (options) {
            var currId = 0;
            this.originalRows = _.clone(this.get("rows"));

            // this.originalRows.map(function (row) {
            //     row.id = currId;
            //     currId++;
            //     return row;
            // });
        },
        doTransforms: function () {
            var newRows = _.clone(this.originalRows);
            if (!_.isUndefined(this.currentSortArgs)) {
                newRows = this._sort.apply(this, this.currentSortArgs)(newRows);  // currentSortArgs = sort ags
            }
            this.set("rows", newRows);
        },
        sort: function (direction, section, attr) {
            this.currentSortArgs = arguments;
            this.doTransforms();
        },
        _sort: function (direction, section, attr) {
            return function (rows) {
                var less = direction == "asc" ? -1 : 1;
                var more = -less;
                rows.sort(function (left, right) {
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
        values: function (section, attr) {
            return _.chain(this.get("rows")).pluck(section).pluck(attr).value();
        },
        // todo DOCUMENT this
        // setOneValue: function (section, attr, id, val) {
        //     this.get("rows").map(function (row) {
        //         if (row.id === id) {
        //             row[section][attr] = val;
        //         }
        //         return row;
        //     });
        // },
        // possibly move these two to a untils class
        intSum: function (values) {
            var returnValue = 0;
            values.forEach(function (cellValue) {
                returnValue += parseInt(cellValue);
            });
            return returnValue;
        },
        floatSum: function (values) {
            var returnValue = 0;
            values.forEach(function (cellValue) {
                returnValue += parseFloat(cellValue);
            });
            return returnValue;
        },
        giveAggregation: function (section, attr, numType, aggregationType) {
            /*
             TODO
             what about nulls!
             What about strings in wrong columns
             */
            var values = this.values(section, attr), returnValue, sum;
            // Move elsewhere if an aggregation does not require sum
            if (numType === 'float') {
                sum = this.floatSum(values);
            } else if (numType === 'int') {
                sum = this.intSum(values);
            }
            if (aggregationType === 'sum') {
                returnValue = sum
            } else if (aggregationType === 'average') {
                returnValue = sum / values.length
            }
            return returnValue;
        }
    });

    var BaseView = Supertable.BaseView = Backbone.View.extend({
        render: function () {
            var attributes = (this.model) ? this.model.attributes : {};
            this.$el.html(this.template(attributes));
            return this;
        }
    });

    var HeaderCellView = Supertable.HeaderCellView = BaseView.extend({
        tagName: "th",
        template: _.template('<a class="name"><%= name %></a> \
            <div class="sort-arrows">\
            <a class="up" href="#">&#x25B2;</a> \
            <a class="down" href="#">&#x25BC;</a></div>'),
        events: {
            "click .up": "sortAsc",
            "click .down": "sortDesc"
        },
        sort: function (direction) {
            // call the "main" sort with these three args ...
            this.trigger("sort", direction, this.model.get("section"), this.model.get("name"));
            return false;
        },
        sortAsc: function () {
            return this.sort("asc");
        },
        sortDesc: function () {
            return this.sort("desc");
        }
    });

    var DataCellView = Supertable.DataCellView = BaseView.extend({
        tagName: "td",
        template: _.template('<span></span>' +
            '<input class="data-input display-only" type="text"/>'),
        initialize: function (options) {
            if (options.section) {
                this.options.section = options.section;
            }
            _.bindAll(this, 'updateModel');
            _.bindAll(this, 'render');
            this.render();
        },
        events: {
            "click": "makeEditable",
            "keyup": "keyPressEventHandler"
        },
        render: function () {
            this.$el.html(this.template());

            if (_.isNull(this.model) || _.isUndefined(this.model.get('val'))) {
                this.$el.find('span').text("NULL").addClass("null");
                this.$el.find('input').val("NULL").addClass("null");
            } else {
                this.$el.find('span').text(this.model.get('val'));
                this.$el.find('input').val(this.model.get('val'));
            }
        },

        makeEditable: function () {
            this.$el.removeClass('display-only');
            this.$el.addClass('editable');
        },
        updateModel: function () {
            this.$el.removeClass('editable');  // has access to
            this.$el.addClass('display-only');

            //sec, name, id, val
            this.trigger('updateRowModel', this.model.get('section'), this.model.get('attr'),
                this.$el.find('input').val());
        },
        keyPressEventHandler: function (event) {
            console.log('DataCellView keyPressEventHandler');
            var code = event.keyCode || event.which;
            // todo add more means to trigger the updateModel event
            if (code == 13) {
                this.updateModel();
            }
        }
    });

    var RowView = Supertable.RowView = BaseView.extend({
        tagName: "tr",
        className: "data-row",
        assignOptions: true,
        initialize: function (options) {
            this.options = {
                schema: options.schema
            };
        },
        render: function () {
            var that = this;
            this.$el.empty(); // start over ;)
            _.each(that.options.schema.sections, _.bind(function (section) {
                _.each(section.attributes, _.bind(function (attr) {
                    var cellVal = this.model.get(section.name)[attr.name],
                    view = new DataCellView({
                        model: new Data({
                            val: cellVal, //rowId: this.model.id,
                            section: section.name, attr: attr.name
                        })
                    });
                    this.listenTo(view, 'updateRowModel', this.updateModelCell);
                    this.$el.append(view.el);
                }, this));
            }, this));
            return this;
        },
        updateModelCell: function (sec, name, val) {
            // pass on in trigger to parent model
            // this.trigger('updateParentModel', sec, name, id, val);

            // console.log("BEFORE ", this.model.get(sec));
            // Note this did not fly -
            // this.model.get(sec).set({ name: val });
            // perhaps bc the sub object was not a bakcbone model itself?

            this.model.get(sec)[name] = val;
            this.trigger('renderTable');
        }
    });

    var AttributeConfig = Supertable.AttributeConfig = Backbone.Model.extend({
        numericTypes: ["int", "float"],
        isNumericType: function () {
            return _.contains(this.numericTypes, this.get("type"));
        },
        initialize: function () {
            return;
        }
    });

    var TableView = Supertable.TableView = BaseView.extend({
        tagName: "table",
        template: _.template('<tr class=\"header sections\"></tr>\
      <tr class=\"header attributes\"></tr><tr class=\"header aggregateHeader\"></tr>\
      <tr class=\"header aggregateValue\"></tr>'),
        initialize: function (options) {
            this.model.on("change:rows", this.renderRows, this);

            this.model.on("change", this.render, this);

            // _.bindAll(this, "render");
            // this.model.bind('change', this.render);

            this.attributeConfigs = [];
            this.options = {
                schema: options.schema
            };
        },
        events: {
            "keyup" : "keyPressEventHandler"
        },
        keyPressEventHandler: function (event) {
            var code = event.keyCode || event.which;
            if (code == 13) {
                console.log('MAIN ENTER keyPressEventHandler');
                // TODO: possibly send an event to close all inputs that might be open
            }
        },
        render: function () {
            var that = this;
            this.stopListening();

            BaseView.prototype.render.apply(this);
            _.each(that.options.schema.sections, _.bind(function (section) {
                // HEADER section only
                var th = $('<th class="section-header">').text(section.name).attr("colspan", section.attributes.length);
                this.$('.sections').append(th);

                _.each(section.attributes, _.bind(function (attr) {
                    var headerView, attributeConfig = new AttributeConfig(_.extend(attr, {
                        attr: attr.name,
                        section: section.name
                    }));
                    // just for test - would move
                    // this.model.giveAggregation(section.name, attr.name);

                    this.attributeConfigs.push(attributeConfig);
                    headerView = new HeaderCellView({model: attributeConfig});
                    this.$('.attributes').append(headerView.render().el); // append to ROW
                    // ties the headerView event 'sort' to this-view.sort (below)
                    this.listenTo(headerView, 'sort', _.bind(this.sort, this)); // ties the  . .
                }, this));
            }, this));
            this.renderRows(); //note!
            // render bottom aggregates
            this.renderAggregateHeaderRows();
            this.renderAggregateValuesRows();
            return this;
        },
        renderRows: function () {
            var that = this;

            this.$("tr.data-row").remove();  //clear all
            _.each(that.model.get("rows"), function (item) {
                var view = new RowView({
                    model: new Data(item),
                    schema: that.options.schema
                });

                // this.listenTo(view, 'updateParentModel', this.updateModelCell);

                // this.listenTo(view, 'checkParentModel', function() {
                //     console.log(' THE model: ', that.model);
                // });

                this.listenTo(view, 'renderTable', this.render);

                view.render().$el.insertAfter(this.$('.attributes')); // insert after this specific part of headr?
            }, this);
        },
        // updateModelCell: function (sec, name, id, val) {
        //     this.model.setOneValue(sec, name, id, val);
        //
        //     //onChange would be more universal!
        //     this.render();
        // },
        renderAggregateHeaderRows: function () {
            var that = this, td;
            this.$("tr.aggregateHeader").empty(); //.remove();  //clear all but not the row!

            _.each(that.options.schema.sections, _.bind(function (section) { //err?
                _.each(section.attributes, _.bind(function (attr) {
                    if (attr.aggregateType) {
                        td = $('<td>').text(attr.aggregateType);  // add a class?
                    } else {
                        td = $('<td>'); // add a class?
                    }
                    this.$('.aggregateHeader').append(td);

                }, this));
            }, this));
        },
        renderAggregateValuesRows: function () {
            var that = this, td, aggVal;
            this.$("tr.aggregateValue").empty(); //clear all but not the row!
            _.each(that.options.schema.sections, _.bind(function (section) {
                _.each(section.attributes, _.bind(function (attr) {
                    if (attr.aggregateType) {
                        aggVal = this.model.giveAggregation(section.name, attr.name, attr.type, attr.aggregateType);
                        td = $('<td>').text(aggVal.toFixed(2));
                    } else {
                        td = $('<td>'); // add a class?
                    }
                    this.$('.aggregateValue').append(td);

                }, this));
            }, this));
        },
        sort: function (direction, section, attr) {
            this.model.sort(direction, section, attr); // sort exists in model but event ties to view to re-render
        }
    });
})();
