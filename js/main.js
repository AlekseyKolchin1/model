$(function() {
    window.dataObj = {};

    var isMobile = window.navigator.userAgent.match(/^((?!chrome|android|crios|fxios).)*safari|iPhone|iPod|Android|BlackBerry|Windows Phone|IEMobile/i) !== null;
    var isTablet = window.navigator.userAgent.match(/Tablet|iPad|iPod/i) && window.innerWidth <= 1280 && window.innerHeight <= 800;

    $('[data-toggle="tooltip"]').tooltip({
        html: true
    });

    $('[data-toggle="popover"]')
        .popover({
            html: true,
            placement: function() {
                return isMobile && !isTablet ? "auto" : $(this.element).data("placement");
            },
            template: '<div class="popover" role="tooltip">' +
                '<button type="button" class="close" data-dismiss="popover" aria-label="Close"><span aria-hidden="true">&times;</span></button>' +
                '<div class="arrow"></div><h3 class="popover-header"></h3><div class="popover-body"></div>' +
                '</div>',
            content: function() {
                var popoverId = $(this).data("content-id");

                if (animationInputs) {
                    $(popoverId + ' .form-control').each(function () {
                        var $item = $(this);
                        var inputName = $item.data("key");
                        var inputValue = animationInputs.getInput(inputName);

                        $item.attr("value", inputValue);
                    });
                }

                return $(popoverId).html();
            },
            sanitize: false
        })
        .on("show.bs.popover", function() {
            $(this).parent().tooltip('hide');
        });

    $("body")
        .on("click", ".popover .close", function () {
            $(this).parent().popover('hide');
        })
        .on("click", function (event) {
            var $navbar = $(".navbar-collapse");
            if ($navbar.hasClass("show") && !$(event.target).hasClass("navbar-toggle")) {
                $navbar.collapse('hide');
            }

            if ($(event.target).data('toggle') !== "popover" && $(event.target).parents('.popover.fade').length === 0) {
                $('[data-toggle="popover"]').popover('hide');
            }
        })
        .on("change", ".popover .form-control", function () {
            if (!animationInputs) {
                return;
            }

            var $input = $(this);
            var inputValue = $input.val();
            var inputName = $input.data("key");

            animationInputs.setInput(inputName, inputValue);
        })
        .on("isReady", function () {
            $("#model-preview").removeClass("disabled");
        });

    var agvItems = ".item-6, .item-6-1, .item-6-2";
    $(agvItems).hover(
        function() {
            $(this)
            .add($(this).siblings(agvItems))
                .addClass("hover");
        },
        function() {
            $(this)
            .add($(this).siblings(agvItems))
                .removeClass("hover");
        }
    );

    var $dropDown = $('.dropdown');
    var $dropDownItem = $dropDown.find('.dropdown-item');
    var $dropDownActive = $dropDownItem.filter(".active");

    // Set as default
    $dropDownActive.each(function() {
        var $this = $(this);
        var $thisParent = $this.parent();
        var idPrefix = $thisParent.data('id-pref');
        $this.parent().prev('.btn').html($this.html());

        setFleetRangeValues($this, idPrefix);
    });

    $dropDownItem.on("click", function(event) {
        event.preventDefault();

        var $this = $(this);
        var $thisParent = $this.parent();
        var idPrefix = $thisParent.data('id-pref');
        var itemHtml = $this.html();
        var $dropDownBtn = $thisParent.prev(".btn");

        setFleetRangeValues($this, idPrefix);

        $this
            .siblings().removeClass("active")
            .end()
            .addClass("active");

        $dropDownBtn.html(itemHtml);
    });

    function setFleetRangeValues($item, idPrefix) {
        var radius = $item.data('radius');
        var $range =  $('#' + idPrefix + '-speed-range');
        var minSpeed = parseFloat($item.data('min-speed'));
        var maxSpeed = parseFloat($item.data('max-speed'));
        var avarageValue = Math.floor((maxSpeed + minSpeed) / 2);

        $('#' + idPrefix + '-radius').text(radius);
        $range
            .attr({
                "min": minSpeed,
                "max": maxSpeed
            })
            .val(avarageValue);

        generateRangeLabels.call($range, minSpeed, maxSpeed, avarageValue, true);

        if (idPrefix === "fleet") {
            var $fleetSpeedAnimation = $("#fleetAnimation-speed-range");
            $fleetSpeedAnimation
                .attr({
                    "min": minSpeed,
                    "max": maxSpeed
                })
                .val(avarageValue);

            generateRangeLabels.call($fleetSpeedAnimation, minSpeed, maxSpeed, avarageValue,  true);
        }
    }

    function generateRangeLabels(min, max, value, isFloat) {
        isFloat = isFloat || false;
        var labelTpl = "";

        for (var i = min; i <= max; i++) {
            var b = isFloat ? (i / 10).toFixed(1) : i;
            labelTpl += '<label class="custom-range-label' + (i === value ? ' active' : '') + '" data-value="' + i + '">' + b + '</label>';
        }

        $(this).prev(".custom-range-labels").html(labelTpl)
    }

    function setRangeActiveLabel(thisValue) {
        $(this).children().removeClass("active");
        $(this).find("[data-value=" + thisValue + "]").addClass("active");
    }

    $(".custom-range").on("input change", function() {
        var $this = $(this);
        var $thisPrev = $this.prev();
        var thisValue = $this.val();
        var idPrefix = $this.attr("id").split("-")[0];

        setRangeActiveLabel.call($thisPrev, thisValue);

        if (idPrefix === "fleet") {
            var $fleetAnimation = $("#fleetAnimation-speed-range");
            $fleetAnimation.val(thisValue);

            setRangeActiveLabel.call($fleetAnimation.prev(), thisValue);
        }

        if (animation && ["fleetAnimation-speed-range", "fleetAnimation-numbers-range"].indexOf($this.attr("id")) !== -1) {
            var inputName = $this.data("key");
            var inputValue = $this.val();

            if ($this.attr("id") === "fleetAnimation-speed-range") {
                inputValue = Number(inputValue) / 10;
                animation.setValue("experiment.root.agvSpeed", inputValue);
            }

            if ($this.attr("id") === "fleetAnimation-numbers-range") {
                animation.setValue("experiment.root.numberOfAGV", Number(inputValue));
            }

            animationInputs.setInput(inputName, inputValue);
        }
    });

    $(".fleet-select").on("change", function() {
        var $this = $(this);
        var thisValue = $this.val();
        var idPrefix = $this.attr("id").split("-")[0];
        var inputName = $this.data("key");

        animationInputs.setInput(inputName, thisValue);

        if (idPrefix === "fleet") {
            var $fleetNumAnimation = $("#fleetAnimation-numbers-range");

            $fleetNumAnimation.val(thisValue);
            setRangeActiveLabel.call($fleetNumAnimation.prev(), thisValue);
        }
    });

    $("#btn-phase-2").on("click", function() {
        if (!animationInputs) {
            return;
        }

        var inputsIdArray = ["fleet-numbers", "fleet-speed-range", "fleet-radius", "fleetStorage-numbers", "fleetStorage-speed-range", "fleetStorage-radius"];

        $.each(inputsIdArray, function(index, item) {
            var $item = $("#" + item);
            var inputName = $item.data("key");
            var inputValue = $item.val() || $item.text();

            animationInputs.setInput(inputName, Number(inputValue));
        });
    });

    $("#docsModal").on("show.bs.modal", function (event) {
        var $link = $(event.relatedTarget);
        var title = $link.html();
        var content = $($link.attr('href')).html();

        $('#docsModalTitle').html(title);
        $('#docsModalContent').html(content);
    });

    var $animationSection = $("#animation");
    var $toggledAnimControls = $animationSection.find(".btn-toolbar .btn").filter(":not(.btn--play)");
    var $animationsControlsSpeed = $animationSection.find(".btn--speed");
    var videoState = {
        status: ["STARTED", "STOPPED", "PAUSED"],
        isVirtualSpeed: false
    };

    drawAnimationPlot();

    $animationSection.find(".btn--play").on("click", function() {
        if (videoState.status !== "STARTED") {
            $toggledAnimControls.removeClass("disabled");
            $animationSection.find(".player-area").addClass("player--running");

            if (!animation || videoState.status === "STOPPED") {
                runAnimation();
            } else {
                animation.resume();
            }

            videoState.status = "STARTED";
        } else if (videoState.status === "STARTED") {
            animation.pause();

            videoState.status = "PAUSED";
        }

        $(this)
            .find(".isPlay, .isPause").toggle();
    });

    $animationSection.find(".btn--stop").on("click", function() {
        if (!animation) {
            return;
        }

        if (videoState.status === "STARTED") {
            $(this)
                .prev()
                .find(".isPlay, .isPause").toggle();
        }

        $toggledAnimControls.addClass("disabled");
        animation.stop();
        videoState.status = "STOPPED";

        if (videoState.isVirtualSpeed) {
            videoState.isVirtualSpeed = false;
            $animationsControlsSpeed.click();
        }
    });

    $animationsControlsSpeed.on("click", function() {
        if (!videoState.isVirtualSpeed) {
            animation.setVirtualTime();
        } else {
            animation.setSpeed(25);
        }

        videoState.isVirtualSpeed = !videoState.isVirtualSpeed;

        $(this)
            .find(".isReal, .isVirtual").toggle();
    });

    $animationSection.find(".btn-group--view .btn").on("click", function() {
        var $this = $(this);
        var dataView = $this.data("view");

        $this.siblings().removeClass("active");
        $this.addClass("active");

        animation.navigateTo(dataView);
    });

    var $btnAnimation = $("#btn-animation");
    $btnAnimation.on("click", function() {
        $animationSection.find(".btn--stop").click();
        stopAnimationPlotDrawing();
    });


    var $variationSection = $("#variation");
    var $variationControlsPlay = $variationSection.find(".btn--play");
    var $variationControlsStop = $variationSection.find(".btn--stop");
    var isExperimentRun = false;

    drawParameterVariationPlot();

    $variationControlsPlay.on("click", function() {
        if (isExperimentRun) {
            return;
        }

        toogleRun(true);
        variationInputsPopulate();
        clearParameterVariationPlot();

        $variationSection.find(".player-area").addClass("player--running");

        runVariation()
            .then(outputs => {
                toogleRun(false);
                endProgressPolling();
                updateParameterVariationPlot(outputs);

                $btnVariation.removeClass("disabled");
            })
            .catch( error => {
                toogleRun(false);
                endProgressPolling();

                alert( "Unable to run parameter variation. Error: " + error );
            });

    });

    $variationControlsStop.on("click", function() {
        if (!isExperimentRun) {
            return;
        }

        toogleRun(false);
        endProgressPolling();
        parameterVariation.stop();
    });

    // Called on [#variation .btn--play] click
    function variationInputsPopulate() {
        var $variationInputs = $("#variation input[data-key]");
        if (variationInputs) {
            $variationInputs.each(function() {
                var $item = $(this);
                var itemId = $item.attr("id");
                var minVal = $("#" + itemId + "-min").val();
                var maxVal = $("#" + itemId + "-max").val();
                var stepVal = $("#" + itemId + "-step").val();
                var inputName = $item.data("key");

                if ($item.data("type") === "integer") {
                    variationInputs.setIntegerRangeInput(inputName, minVal, maxVal, stepVal);
                }
                if ($item.data("type") === "double") {
                    variationInputs.setDoubleRangeInput(inputName, minVal, maxVal, stepVal);
                }
            });
        }
    }

    function toogleRun(isRun) {
        isExperimentRun = isRun;
        if (isRun) {
            $variationControlsPlay.addClass("disabled");
            $variationControlsStop.removeClass("disabled");
        } else {
            $variationControlsPlay.removeClass("disabled");
            $variationControlsStop.addClass("disabled");
        }
    }


    var $btnVariation = $("#btn-variation");

    $btnVariation.on("click", function() {
        var $tableResultSection = $("#save-data");
        var $tableResult = $("#table-result-wrapper");

        if ($tableResult.children().length) {
            return;
        }

        $tableResultSection.removeClass("d-none");

        var $tableContent = $("#table-result").clone();

        $tableContent
            .removeAttr("id")
            .find(".form-control")
            .removeClass("form-control")
            .addClass("form-control-plaintext")
            .attr("type", "text")
            .attr("readonly", "readonly");

        $tableResult.append($tableContent);
    });

    $(window).on("resize", function() {
        if (!window.location.hash) {
            return;
        }

        $(window.location.hash)[0].scrollIntoView();
    });
});
